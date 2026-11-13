import type {
	FolderEntry,
	FolderFileResult,
	FolderUploadEvent,
	FolderUploadOptions,
	FolderUploadResponse,
	PinataConfig,
} from "../../types";
import {
	FolderUploadError,
	NetworkError,
	PinataError,
	ValidationError,
} from "../../../utils/custom-errors";
import {
	FolderCredentials,
	MAX_RENEWALS,
	type TrackedHeaders,
} from "./folderAuth";
import {
	folderEntries,
	folderLimits,
	rejectUnsupported,
	type ResolvedEntry,
	resolveFolderId,
	unsendablePath,
} from "./folderInput";
import { type SyncedFolder, syncFolder } from "./folderSync";
import {
	creationUrl,
	registerResumable,
	sendResumable,
	type StoredUpload,
} from "./resumable";
import {
	isFinalizing,
	isOffline,
	isTransient,
	retryDelay,
	sleep,
	untilOnline,
} from "./retry";
import { Semaphore } from "./semaphore";
import {
	fileMetadata,
	optionsMetadata,
	parseUploadMetadata,
} from "./tusMetadata";
import { registrationTimeout } from "./tusStatus";
import { cancelled } from "./uploadErrors";

const DEFAULT_UPLOAD_URL = "https://uploads.pinata.cloud/v3";
// A file's bytes are stored seconds to minutes before the server registers it. Files waiting
// for that don't hold a send slot, but at most this many per slot are under way at once, so
// that a large folder doesn't poll the registration of thousands of files. When registration
// is slow, a lower cap leaves the send slots idle; a higher one polls more files at once.
const UNDER_WAY_PER_SLOT = 8;
// How often the file every other one waits for (the first, which creates the folder) checks
// its registration: the others start as soon as it is registered.
const GATE_POLL_MS = 1000;
// Refusals of a file for a reason of its own (its path, type or size), which another file
// may not get
const OWN_REFUSALS = [400, 413, 414, 415, 422, 431];
// How many files in a row failing alike show that every file would
const SHARED_FAILURE_REPEATS = 3;

type FileAbout = Pick<FolderFileResult, "index" | "path" | "size">;
type FailedFile = FolderUploadError["failed"][number];

interface FolderPlan {
	folderId: string;
	folderName: string;
	entries: ResolvedEntry[];
	concurrency: number;
	retries: number;
}

// Uploads a folder file by file: each file is its own resumable upload into the folder,
// several at a time, each retried on its own. A final sync gives the folder's CID.
//
// A new folder's first file is uploaded alone, so that the folder exists before the others
// join it. If it fails for a reason of its own, the next one tries. The files of a folder
// given (folderId) all go at once: it exists already.
export const uploadFolder = async (
	config: PinataConfig | undefined,
	files: File[] | FolderEntry[],
	network: "public" | "private",
	options: FolderUploadOptions = {},
): Promise<FolderUploadResponse> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}
	rejectUnsupported(options);
	const { folderName, entries } = folderEntries(files, options.metadata?.name);
	const { concurrency, retries } = folderLimits(options);
	const folderId = resolveFolderId(options.folderId);
	return new FolderUpload(config, network, options, {
		folderId,
		folderName,
		entries,
		concurrency,
		retries,
	}).run();
};

class FolderUpload {
	private readonly uploaded: FolderFileResult[] = [];
	private readonly failed: FailedFile[] = [];
	private readonly credentials: FolderCredentials;
	// Sending bytes takes a slot; waiting for registration doesn't
	private readonly slots: Semaphore;
	private readonly endpoint: string;
	private readonly createUrl: string;
	// The same folder options on every file
	private readonly sharedMetadata: string;
	// A file the server registered as an earlier folder (a one-file folder matching one):
	// the server then removes this folder, and syncing it answers 404
	private duplicateOf: { id: string; name: string; cid: string } | undefined;
	// The reason the last files failed for good, and how many in a row failed for it
	private lastFailure: { reason: string; repeats: number } | undefined;
	// In a folder given (folderId): the failure SHARED_FAILURE_REPEATS files in a row met,
	// which every file would. Files not sent yet fail with it instead of being sent.
	private sharedFailure: Error | undefined;

	constructor(
		config: PinataConfig,
		private readonly network: "public" | "private",
		private readonly options: FolderUploadOptions,
		private readonly plan: FolderPlan,
	) {
		this.credentials = new FolderCredentials(config, options);
		this.slots = new Semaphore(plan.concurrency);
		this.endpoint = config.uploadUrl || DEFAULT_UPLOAD_URL;
		this.createUrl = creationUrl(
			`${this.endpoint}/files/${plan.folderId}`,
			options.cid_version,
		);
		this.sharedMetadata = optionsMetadata(network, options);
	}

	async run(): Promise<FolderUploadResponse> {
		const { folderId, entries } = this.plan;
		// A folder given exists already: no file has to create it first
		const pending =
			this.options.folderId === undefined ? await this.createFolder() : entries;
		await this.uploadAll(pending);
		if (this.failed.length > 0) {
			throw await this.partialFailure();
		}

		const folder = await this.finish();
		// At least these files: a folder uploaded into (folderId) also holds the earlier ones
		if (folder.number_of_files < entries.length) {
			throw new NetworkError(
				`Folder ${folderId} holds ${folder.number_of_files} of the ${entries.length} uploaded files`,
				0,
				{
					error: "folder file count mismatch",
					code: "HTTP_ERROR",
					metadata: {
						folderId,
						expected: entries.length,
						actual: folder.number_of_files,
					},
				},
			);
		}
		return this.response(folder);
	}

	// Uploads the smallest of the shallowest files first: it creates the folder, and the
	// others wait for it. If it fails for a reason of its own (its path, type or size), the
	// next one tries. A failure every file would share stops the upload: any other error, or
	// the same reason SHARED_FAILURE_REPEATS times in a row (see noteFailure; a missing
	// group answers 400 to every file). Returns the files left to upload.
	private async createFolder(): Promise<ResolvedEntry[]> {
		const pending = this.plan.entries.slice();
		for (;;) {
			const [first] = pending.splice(firstToSend(pending), 1);
			await this.uploadFile(first, true);
			if (this.uploaded.length > 0 || this.options.signal?.aborted) {
				return pending;
			}
			const { error } = this.failed[this.failed.length - 1];
			const status =
				error instanceof PinataError ? error.statusCode : undefined;
			const ownReason =
				error instanceof ValidationError || OWN_REFUSALS.includes(status ?? 0);
			if (
				error === this.credentials.refused() ||
				!ownReason ||
				(this.lastFailure?.repeats ?? 0) >= SHARED_FAILURE_REPEATS ||
				pending.length === 0
			) {
				throw error instanceof PinataError
					? error
					: new PinataError(`Error uploading folder: ${error.message}`);
			}
		}
	}

	// A fixed set of workers, each taking the next file once done with one: at most
	// UNDER_WAY_PER_SLOT files per slot under way, and no task held for each of the files
	// waiting.
	private async uploadAll(entries: ResolvedEntry[]): Promise<void> {
		let next = 0;
		const worker = async () => {
			while (next < entries.length)
				await this.uploadFile(entries[next++], false);
		};
		await Promise.all(
			Array.from(
				{
					length: Math.min(
						this.plan.concurrency * UNDER_WAY_PER_SLOT,
						entries.length,
					),
				},
				worker,
			),
		);
	}

	// Sends the file, then waits for its registration, retrying both until the file is
	// registered or fails for good. `gate`: the other files wait for this one's
	// registration.
	private async uploadFile(entry: ResolvedEntry, gate: boolean): Promise<void> {
		const { index, path, file } = entry;
		const { signal } = this.options;
		const about: FileAbout = { index, path, size: file.size };
		// A failure already noted (see noteFailure) before the file fails with it
		let noted: Error | undefined;
		const fail = (error: Error, attempt: number) => {
			this.failed.push({ ...about, error });
			if (error !== noted) this.noteFailure(error);
			this.emit({ type: "error", ...about, attempt, error });
		};
		const unsendable = unsendablePath(path);
		if (unsendable) return fail(unsendable, 0);

		const metadata = `${fileMetadata(path, file.type)},${this.sharedMetadata}`;
		// Kept across attempts: once every byte is stored, an attempt only waits for the
		// file's registration again
		let stored: StoredUpload | undefined;
		// An upload an attempt left unfinished, which the next one continues
		let unfinished: string | undefined;
		// Failed attempts counted against `retries`: not those made while offline, nor those
		// refused a JWT since replaced (at most MAX_RENEWALS of them in a row without progress)
		let spent = 0;
		let renewals = 0;
		// How far the server holds the file's bytes, as the last failed attempt reported
		let reached = 0;
		// Attempts that started (sent a request): the `attempt` of the file's events
		let started = 0;
		// Sent again because the response holding the file's own CID was lost (at most once)
		let resent = false;
		// Attempts refused while the server finishes an earlier upload of the path, which are
		// not counted until `waitUntil` (see FolderUploadEvent.waitingForPreviousUpload)
		let waits = 0;
		let waitUntil: number | undefined;
		for (;;) {
			if (signal?.aborted) return fail(cancelled(), started);
			// The attempt failed with another file's refusal of the JWT, before sending anything
			let borrowed = false;
			// The attempt found that every file fails alike (sharedFailure), before sending
			let stopped = false;
			// The attempt found the file registered without its own CID, and sends it again
			let resend = false;
			const auth = this.credentials.tracked();
			const wasStored = stored !== undefined;
			const wasStarted = unfinished !== undefined;
			try {
				if (stored) {
					this.emit({ type: "start", ...about, attempt: ++started });
				} else {
					// Only sending the bytes takes a slot: waiting for registration doesn't.
					stored = await this.slots.run(async () => {
						const refusal = this.credentials.refused();
						if (refusal) {
							borrowed = true;
							throw refusal;
						}
						// Not a file under way: only one never sent
						if (started === 0 && this.sharedFailure) {
							stopped = true;
							throw this.sharedFailure;
						}
						if (signal?.aborted) throw cancelled();
						this.emit({ type: "start", ...about, attempt: ++started });
						try {
							return await sendResumable(
								this.createUrl,
								auth.headers,
								file,
								metadata,
								{
									inline: true,
									signal,
									resumeUrl: unfinished,
									waitOnline: true,
								},
							);
						} catch (error) {
							// Before the slot goes to the next file, which must not be sent with a
							// JWT refused for good, nor after files in a row failed alike
							const renewed = await this.credentials.renew(error, auth.jwt());
							if (
								!renewed &&
								error instanceof Error &&
								!isTransient(error) &&
								!signal?.aborted
							) {
								noted = error;
								this.noteFailure(error);
							}
							throw error;
						}
					});
				}
				this.emit({ type: "sent", ...about, attempt: started });
				const cid = await this.register(stored, auth, file.size, gate, !resent);
				if (cid === undefined) {
					// The response that completed the upload, which held the file's own CID, was
					// lost: the server now reports the earlier folder's. Sent again (once), the
					// file completes a new upload, whose last response holds its CID.
					const requestUrl = stored.url;
					resent = resend = true;
					stored = undefined;
					unfinished = undefined;
					throw new NetworkError(
						"The file is registered, but the response holding its own CID was lost",
						0,
						{
							error: "file CID lost",
							code: "HTTP_ERROR",
							metadata: { requestUrl },
						},
					);
				}
				this.uploaded.push({ ...about, cid });
				this.lastFailure = undefined;
				this.emit({ type: "complete", ...about, attempt: started, cid });
				return;
			} catch (caught) {
				if (signal?.aborted) return fail(cancelled(), started);
				const error =
					caught instanceof Error ? caught : new Error(String(caught));
				// Another file's refusal: none of its upload state (uploadUrl, uploadOffset)
				// is this file's. It fails with it, unless the JWT was replaced since: then
				// it is sent for real, as an attempt of its own.
				if (borrowed) {
					if (this.credentials.refused()) return fail(error, started);
					continue;
				}
				if (stopped) return fail(error, started);
				// Not counted against `retries`: nothing failed, the CID was lost
				if (resend) {
					this.emit({
						type: "retry",
						...about,
						attempt: started,
						error,
						delayMs: 0,
					});
					continue;
				}
				// Progress: the server accepted something of this attempt (its bytes, the upload,
				// or some of its chunks)
				let progressed = !wasStored && stored !== undefined;
				if (error instanceof PinataError) {
					const reported = error.details?.metadata;
					unfinished = reported?.uploadUrl ?? unfinished;
					if (!wasStarted && unfinished !== undefined) progressed = true;
					if (
						typeof reported?.uploadOffset === "number" &&
						reported.uploadOffset > reached
					) {
						reached = reported.uploadOffset;
						progressed = true;
					}
				}
				if (progressed) renewals = 0;
				const renewed = await this.credentials.renew(error, auth.jwt());
				// No answer while the browser is offline: the next attempt waits until it is
				// back online, and this one is not counted
				const offline =
					(!(error instanceof PinataError) || error.statusCode === 0) &&
					isOffline();
				// The server still finishes an earlier upload of the path: not counted, for as long
				// as the server may take to register a file of this size
				let previous = false;
				if (isFinalizing(error)) {
					waitUntil ??= Date.now() + registrationTimeout(file.size);
					previous = Date.now() < waitUntil;
				}
				if (
					renewed
						? ++renewals > MAX_RENEWALS
						: !isTransient(error) ||
							(!offline && !previous && ++spent > this.plan.retries)
				) {
					return fail(error, started);
				}
				const delayMs =
					renewed || offline
						? 0
						: retryDelay(previous ? ++waits : spent, error);
				this.emit({
					type: "retry",
					...about,
					attempt: started,
					error,
					delayMs,
					...(offline ? { waitingForOnline: true } : {}),
					...(previous ? { waitingForPreviousUpload: true } : {}),
				});
				if (offline) await untilOnline(signal);
				else await sleep(delayMs, signal);
			}
		}
	}

	// Notes a file that failed for good. Files failing in a row for the same reason (the same
	// status and message) SHARED_FAILURE_REPEATS times show that every file would: in a folder
	// given, the files not sent yet then fail with it (a new folder's first files stop the
	// upload instead, see createFolder). Not a cancel, nor the failures that are already
	// shared (a refused JWT, sharedFailure itself).
	private noteFailure(error: Error): void {
		if (
			this.options.signal?.aborted ||
			error === this.sharedFailure ||
			error === this.credentials.refused()
		) {
			return;
		}
		const status = error instanceof PinataError ? error.statusCode : undefined;
		const reason = `${status} ${error.message}`;
		const repeats =
			this.lastFailure?.reason === reason ? this.lastFailure.repeats + 1 : 1;
		this.lastFailure = { reason, repeats };
		if (repeats >= SHARED_FAILURE_REPEATS && this.options.folderId) {
			this.sharedFailure ??= error;
		}
	}

	// Waits until the file is registered, which puts it in the folder, and returns its own
	// CID. It may be reported as an earlier upload when, alone, it matches one (a one-file
	// folder of the same name and content): its object is in this folder all the same, and
	// its CID is its own. Only the response that completed the upload holds that CID: when
	// that response was lost, undefined if `mayResend` (the file is to be sent again), else
	// empty, as when the response held none: unknown, rather than the earlier folder's.
	private async register(
		stored: StoredUpload,
		auth: TrackedHeaders,
		size: number,
		gate: boolean,
		mayResend: boolean,
	): Promise<string | undefined> {
		const registered = await registerResumable(
			stored,
			auth.headers,
			size,
			this.options.signal,
			gate ? GATE_POLL_MS : undefined,
		);
		const reported = parseUploadMetadata(registered.metadata);
		if (
			reported.file_id &&
			reported.file_id !== this.plan.folderId &&
			reported.filename &&
			!reported.filename.includes("/") &&
			reported.cid
		) {
			this.duplicateOf = {
				id: reported.file_id,
				name: reported.filename,
				cid: reported.cid,
			};
			if (!registered.ownCid) {
				return registered.completedBy === "lookup" && mayResend
					? undefined
					: "";
			}
		}
		return registered.cid;
	}

	private async finish(): Promise<SyncedFolder> {
		const { folderId, retries } = this.plan;
		try {
			const auth = this.credentials.tracked();
			return await syncFolder(
				this.endpoint,
				folderId,
				auth.headers,
				retries,
				this.options.signal,
				(error) => this.credentials.renew(error, auth.jwt()),
			);
		} catch (error) {
			// Only a one-file folder is merged into an earlier one
			if (
				!this.duplicateOf ||
				this.uploaded.length !== 1 ||
				!(error instanceof PinataError) ||
				error.statusCode !== 404
			) {
				throw error;
			}
			return {
				...this.duplicateOf,
				size: this.uploaded.reduce((sum, f) => sum + f.size, 0),
				number_of_files: this.uploaded.length,
				is_duplicate: true,
			};
		}
	}

	// The server completes the folder without the failed files: its CID, or the earlier
	// folder it turned out to duplicate, is worth knowing. Best effort: a failed sync leaves
	// it unknown and must not hide why the files failed.
	private async partialFailure(): Promise<FolderUploadError> {
		const { folderId, folderName, entries } = this.plan;
		const folder =
			this.uploaded.length > 0 &&
			!this.options.signal?.aborted &&
			!this.credentials.refused()
				? await this.finish().then(
						(synced) => ({
							id: synced.id,
							name: synced.name,
							cid: synced.cid,
							...(synced.is_duplicate ? { is_duplicate: true } : {}),
						}),
						() => undefined,
					)
				: undefined;
		const [first] = this.failed;
		return new FolderUploadError(
			`${this.failed.length} of ${entries.length} files could not be uploaded to folder ${folderId}: ${first.path}: ${first.error.message}`,
			folderId,
			this.uploaded,
			this.failed,
			folder,
			folderName,
		);
	}

	private response(folder: SyncedFolder): FolderUploadResponse {
		const byIndex = new Map(
			this.uploaded.map((result) => [result.index, result]),
		);
		// Content already uploaded resolves to that earlier folder: its files' paths start
		// with its name
		const rename = (path: string) =>
			folder.is_duplicate && folder.name
				? `${folder.name}${path.slice(path.indexOf("/"))}`
				: path;
		return {
			id: folder.id,
			name: folder.name,
			cid: folder.cid,
			size: folder.size,
			created_at: folder.created_at ?? "",
			number_of_files: folder.number_of_files,
			mime_type: folder.mime_type ?? "directory",
			group_id: this.options.groupId ?? null,
			keyvalues: this.options.metadata?.keyvalues ?? {},
			vectorized: false,
			network: folder.network ?? this.network,
			...(folder.is_duplicate ? { is_duplicate: true } : {}),
			// In the order they were given
			files: this.plan.entries.map((entry) => {
				const result = byIndex.get(entry.index) as FolderFileResult;
				return { ...result, path: rename(result.path) };
			}),
		};
	}

	private emit(
		event: Omit<FolderUploadEvent, "completed" | "failed" | "total">,
	): void {
		try {
			this.options.onProgress?.({
				...event,
				completed: this.uploaded.length,
				failed: this.failed.length,
				total: this.plan.entries.length,
			});
		} catch {
			// The observer's failure, not the file's: it must not fail the file, send a
			// registered file again, or leave the other files uploading unawaited.
		}
	}
}

// The position in `entries` of the smallest of the shallowest files
const firstToSend = (entries: ResolvedEntry[]): number => {
	const depth = (entry: ResolvedEntry) => entry.path.split("/").length;
	let pick = 0;
	for (let i = 1; i < entries.length; i++) {
		const [a, b] = [entries[i], entries[pick]];
		if (
			depth(a) < depth(b) ||
			(depth(a) === depth(b) && a.file.size < b.file.size)
		) {
			pick = i;
		}
	}
	return pick;
};
