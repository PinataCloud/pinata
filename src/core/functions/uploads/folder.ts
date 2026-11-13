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
	registerResumable,
	sendResumable,
	type StoredUpload,
} from "./resumable";
import {
	encodeMetadataValue,
	parseUploadMetadata,
	serverReason,
} from "./tusMetadata";
import { type RequestHeaders, resolveHeaders } from "./tusStatus";
import { isOffline, parseRetryAfter, sleep, untilOnline } from "./wait";

const DEFAULT_CONCURRENCY = 4;
const DEFAULT_RETRIES = 3;
const DEFAULT_FOLDER_NAME = "folder_from_sdk";
// How many times a file is sent again because the JWT it was refused was replaced
const MAX_RENEWALS = 2;
// A file's bytes are stored seconds before the server registers it. Files waiting for that
// don't hold a send slot, but at most this many per slot are under way at once, so that a
// large folder doesn't poll the registration of thousands of files.
const UNDER_WAY_PER_SLOT = 4;

// Uploads a folder file by file: each file is its own resumable upload into the folder,
// several at a time, each retried on its own. A final sync gives the folder's CID.
//
// The first file is uploaded alone, so that the folder exists before the others join it.
// If it fails for a reason of its own, the next one tries.
export const uploadFolder = async (
	config: PinataConfig | undefined,
	files: File[] | FolderEntry[],
	network: "public" | "private",
	options?: FolderUploadOptions,
): Promise<FolderUploadResponse> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}
	rejectUnsupported(options);
	const entries = folderEntries(files, options?.metadata?.name);
	const concurrency = Math.max(
		1,
		Math.floor(options?.concurrency ?? DEFAULT_CONCURRENCY),
	);
	const retries = Math.max(0, Math.floor(options?.retries ?? DEFAULT_RETRIES));

	// Built for every file and request: a JWT set with setNewJwt during a long upload (the
	// dashboard's tokens last 30 minutes) is used from then on
	const headers = (): Record<string, string> => {
		const jwt = options?.keys || config.pinataJwt;
		return config.customHeaders && Object.keys(config.customHeaders).length > 0
			? { Authorization: `Bearer ${jwt}`, ...config.customHeaders }
			: { Authorization: `Bearer ${jwt}`, Source: "sdk/folder" };
	};
	const endpoint = config.uploadUrl || "https://uploads.pinata.cloud/v3";

	if (
		options?.folderId !== undefined &&
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
			options.folderId,
		)
	) {
		throw new ValidationError(
			`The folder id must be a UUID: got "${options.folderId}"`,
		);
	}
	const folderId = options?.folderId ?? uuidv7();
	const signal = options?.signal;
	const createUrl = new URL(`${endpoint}/files/${folderId}`);
	if (options?.cid_version !== undefined) {
		createUrl.searchParams.set(
			"X-Upload-Option-Cid-Version",
			options.cid_version.toString(),
		);
	}

	// The same folder options on every file.
	let sharedMetadata = `network ${encodeMetadataValue(network)}`;
	if (options?.groupId) {
		sharedMetadata += `,group_id ${encodeMetadataValue(options.groupId)}`;
	}
	if (options?.metadata?.keyvalues) {
		sharedMetadata += `,keyvalues ${encodeMetadataValue(JSON.stringify(options.metadata.keyvalues))}`;
	}
	if (options?.cid_version !== undefined) {
		sharedMetadata += `,cid_version ${encodeMetadataValue(options.cid_version)}`;
	}
	if (options?.expires_at !== undefined) {
		sharedMetadata += `,expires_at ${encodeMetadataValue(options.expires_at.toString())}`;
	}

	const total = entries.length;
	const uploaded: FolderFileResult[] = [];
	const failed: { index: number; path: string; size: number; error: Error }[] =
		[];
	const emit = (
		event: Omit<FolderUploadEvent, "completed" | "failed" | "total">,
	) => {
		try {
			options?.onProgress?.({
				...event,
				completed: uploaded.length,
				failed: failed.length,
				total,
			});
		} catch {
			// The observer's failure, not the file's: it must not fail the file, send a
			// registered file again, or leave the other files uploading unawaited.
		}
	};

	const slots = new Semaphore(concurrency);
	const underWay = new Semaphore(concurrency * UNDER_WAY_PER_SLOT);

	const currentJwt = () => options?.keys || config.pinataJwt || "";
	// An authentication failure no other file can avoid, and the JWT it was for: files not
	// started yet fail with it instead of being sent, until another JWT is in use.
	let fatal: { error: Error; jwt: string } | undefined;
	const fatalNow = () =>
		fatal && fatal.jwt === currentJwt() ? fatal.error : undefined;
	// After `error`, true if it is a 401 or 403 for `refused` and another JWT is now in use:
	// one set meanwhile (setNewJwt), else one from refreshJwt, asked once per refused JWT.
	// A refusal that no other JWT follows is fatal.
	let renewal: { jwt: string; done: Promise<void> } | undefined;
	const renewJwt = async (error: unknown, refused: string) => {
		if (
			!(error instanceof PinataError) ||
			(error.statusCode !== 401 && error.statusCode !== 403)
		) {
			return false;
		}
		const refresh = options?.refreshJwt;
		if (currentJwt() === refused && refresh && !options?.keys) {
			if (renewal?.jwt !== refused) {
				renewal = {
					jwt: refused,
					done: (async () => {
						try {
							const jwt = await refresh();
							// What setNewJwt does: the SDK uses it from then on
							if (jwt) config.pinataJwt = jwt;
						} catch {
							// No new JWT: the refusal stands
						}
					})(),
				};
			}
			await renewal.done;
		}
		if (currentJwt() !== refused) return true;
		if (!fatalNow()) fatal = { error, jwt: refused };
		return false;
	};
	// A file the server registered as an earlier folder (a one-file folder matching one):
	// the server then removes this folder, and syncing it answers 404
	let duplicateOf: { id: string; name: string; cid: string } | undefined;
	const finishFolder = async (): Promise<SyncedFolder> => {
		try {
			return await syncFolder(endpoint, folderId, headers, retries, signal);
		} catch (error) {
			if (
				!duplicateOf ||
				!(error instanceof PinataError) ||
				error.statusCode !== 404
			) {
				throw error;
			}
			return {
				...duplicateOf,
				size: uploaded.reduce((sum, f) => sum + f.size, 0),
				number_of_files: uploaded.length,
				is_duplicate: true,
			};
		}
	};

	const uploadEntry = (entry: ResolvedEntry) =>
		underWay.run(() => uploadOne(entry));
	const uploadOne = async (entry: ResolvedEntry): Promise<void> => {
		const { index, path, file } = entry;
		const fail = (error: Error, attempt: number) => {
			failed.push({ index, path, size: file.size, error });
			emit({ type: "error", index, path, size: file.size, attempt, error });
		};
		// files-api leaves "%" unescaped in the upload URL, so checking the upload hits
		// another path (404) and the file would be reported failed while it lands in the
		// folder. Not sent until the server escapes it.
		if (path.includes("%")) {
			fail(
				new ValidationError(
					`File paths containing "%" cannot be uploaded yet: "${path}"`,
				),
				0,
			);
			return;
		}
		// Kept across attempts: once every byte is stored, an attempt only waits for the
		// file's registration again
		let stored: StoredUpload | undefined;
		// Failed attempts counted against `retries`: not those made while offline, nor those
		// refused a JWT since replaced (at most MAX_RENEWALS of them)
		let spent = 0;
		let renewals = 0;
		for (let attempt = 1; ; attempt++) {
			if (signal?.aborted) {
				fail(cancelled(), attempt - 1);
				return;
			}
			const jwt = currentJwt();
			try {
				if (stored) {
					emit({ type: "start", index, path, size: file.size, attempt });
				} else {
					// Only sending the bytes takes a slot: waiting for registration doesn't.
					stored = await slots.run(async () => {
						const refused = fatalNow();
						if (refused) throw refused;
						if (signal?.aborted) throw cancelled();
						emit({ type: "start", index, path, size: file.size, attempt });
						try {
							return await sendResumable(
								createUrl.toString(),
								headers,
								file,
								`filename ${encodeMetadataValue(path)},filetype ${encodeMetadataValue(file.type)},${sharedMetadata}`,
								true,
								signal,
							);
						} catch (error) {
							// Before the slot goes to the next file, which must not be sent with a
							// JWT refused for good
							await renewJwt(error, jwt);
							throw error;
						}
					});
				}
				// The file is in the folder once registered. It may be reported as an earlier
				// upload when, alone, it matches one (a one-file folder of the same name and
				// content): its object is in this folder all the same, and its CID is its own.
				const registered = await registerResumable(
					stored,
					headers,
					file.size,
					signal,
				);
				const reported = parseUploadMetadata(registered.metadata);
				if (
					reported.file_id &&
					reported.file_id !== folderId &&
					reported.filename &&
					!reported.filename.includes("/") &&
					reported.cid
				) {
					duplicateOf = {
						id: reported.file_id,
						name: reported.filename,
						cid: reported.cid,
					};
				}
				const result = {
					index,
					path,
					size: file.size,
					cid: registered.cid as string,
				};
				uploaded.push(result);
				emit({
					type: "complete",
					index,
					path,
					size: file.size,
					attempt,
					cid: result.cid,
				});
				return;
			} catch (caught) {
				if (signal?.aborted) {
					fail(cancelled(), attempt);
					return;
				}
				const error =
					caught instanceof Error ? caught : new Error(String(caught));
				const renewed = await renewJwt(error, jwt);
				// No answer while the browser is offline: the next attempt waits until it is
				// back online, and this one is not counted
				const offline =
					(!(error instanceof PinataError) || error.statusCode === 0) &&
					isOffline();
				if (
					renewed
						? ++renewals > MAX_RENEWALS
						: !isTransient(error) || (!offline && ++spent > retries)
				) {
					fail(error, attempt);
					return;
				}
				const delayMs =
					renewed || offline ? 0 : Math.max(backoff(spent), retryAfter(error));
				emit({
					type: "retry",
					index,
					path,
					size: file.size,
					attempt,
					error,
					delayMs,
				});
				if (offline) await untilOnline(signal);
				else await sleep(delayMs, signal);
			}
		}
	};

	// The smallest of the shallowest files first: it creates the folder, and the others wait
	// for it. If it fails for a reason of its own (its path, type or size), the next one
	// tries. A failure every file would share stops the upload: any other error, or the same
	// reason three times in a row (a missing group answers 400 to every file).
	const pending = entries.slice();
	const depth = (entry: ResolvedEntry) => entry.path.split("/").length;
	let previousReason: string | undefined;
	let repeats = 0;
	for (;;) {
		let pick = 0;
		for (let i = 1; i < pending.length; i++) {
			const [a, b] = [pending[i], pending[pick]];
			if (
				depth(a) < depth(b) ||
				(depth(a) === depth(b) && a.file.size < b.file.size)
			) {
				pick = i;
			}
		}
		const [first] = pending.splice(pick, 1);
		await uploadEntry(first);
		if (uploaded.length > 0 || signal?.aborted) break;
		const { error } = failed[failed.length - 1];
		const status = error instanceof PinataError ? error.statusCode : undefined;
		const reason = `${status} ${error.message}`;
		repeats = reason === previousReason ? repeats + 1 : 1;
		previousReason = reason;
		const ownReason =
			error instanceof ValidationError ||
			[400, 413, 414, 415, 422, 431].includes(status ?? 0);
		if (
			error === fatalNow() ||
			!ownReason ||
			repeats >= 3 ||
			pending.length === 0
		) {
			throw error instanceof PinataError
				? error
				: new PinataError(`Error uploading folder: ${error.message}`);
		}
	}
	await Promise.all(pending.map((entry) => uploadEntry(entry)));

	if (failed.length > 0) {
		// The server completes the folder without the failed files: its CID, or the earlier
		// folder it turned out to duplicate, is worth knowing. Best effort: a failed sync
		// leaves it unknown and must not hide why the files failed.
		const folder =
			uploaded.length > 0 && !signal?.aborted && !fatalNow()
				? await finishFolder().then(
						(synced) => ({
							id: synced.id,
							name: synced.name,
							cid: synced.cid,
							...(synced.is_duplicate ? { is_duplicate: true } : {}),
						}),
						() => undefined,
					)
				: undefined;
		throw new FolderUploadError(
			`${failed.length} of ${total} files could not be uploaded to folder ${folderId}: ${failed[0].path}: ${failed[0].error.message}`,
			folderId,
			uploaded,
			failed,
			folder,
		);
	}

	const folder = await finishFolder();
	// At least these files: a folder uploaded into (folderId) also holds the earlier ones
	if (folder.number_of_files < total) {
		throw new NetworkError(
			`Folder ${folderId} holds ${folder.number_of_files} of the ${total} uploaded files`,
			0,
			{
				error: "folder file count mismatch",
				code: "HTTP_ERROR",
				metadata: { folderId, expected: total, actual: folder.number_of_files },
			},
		);
	}

	const byIndex = new Map(uploaded.map((result) => [result.index, result]));
	// Content already uploaded resolves to that earlier folder: its files' paths start with
	// its name
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
		group_id: options?.groupId ?? null,
		keyvalues: options?.metadata?.keyvalues ?? {},
		vectorized: false,
		network: folder.network ?? network,
		...(folder.is_duplicate ? { is_duplicate: true } : {}),
		// In the order they were given
		files: entries.map((entry) => {
			const result = byIndex.get(entry.index) as FolderFileResult;
			return { ...result, path: rename(result.path) };
		}),
	};
};

// `index`: the file's position in the files given
type ResolvedEntry = { index: number; path: string; file: File };

interface SyncedFolder {
	id: string;
	name: string;
	cid: string;
	size: number;
	number_of_files: number;
	network?: string;
	mime_type?: string;
	created_at?: string;
	/** The folder's content was already uploaded: this is that earlier folder */
	is_duplicate?: boolean;
}

// What a file, or finishing the folder, fails with once the upload is cancelled
const cancelled = () => {
	const error = new PinataError("The upload was cancelled");
	error.name = "AbortError";
	return error;
};

// Computes the folder's CID from every registered file and says how many files it holds.
const syncFolder = async (
	endpoint: string,
	folderId: string,
	headers: RequestHeaders,
	retries: number,
	signal?: AbortSignal,
): Promise<SyncedFolder> => {
	const requestUrl = `${endpoint}/buckets/${folderId}/sync`;
	for (let attempt = 1, spent = 0; ; attempt++) {
		let error: NetworkError;
		try {
			const res = await fetch(requestUrl, {
				method: "PUT",
				headers: resolveHeaders(headers),
				signal,
			});
			if (res.ok) {
				const body = await res.json();
				return body.data as SyncedFolder;
			}
			const text = await res.text().catch(() => "");
			const reason = serverReason(text);
			error = new NetworkError(
				`Could not finish the folder (HTTP ${res.status})${reason ? `: ${reason}` : ""}`,
				res.status,
				{
					error: text,
					code: "HTTP_ERROR",
					metadata: {
						requestUrl,
						folderId,
						retryAfterMs: parseRetryAfter(res.headers),
					},
				},
			);
		} catch (caught) {
			if (signal?.aborted) throw cancelled();
			const message = caught instanceof Error ? caught.message : String(caught);
			error = new NetworkError(
				`Could not finish the folder: could not reach the upload server: ${message}`,
				0,
				{
					error: message,
					code: "NETWORK_ERROR",
					metadata: { requestUrl, folderId },
				},
			);
		}
		// Offline in a browser: wait until back online, without counting the attempt
		if (error.statusCode === 0 && (await untilOnline(signal))) {
			if (signal?.aborted) throw cancelled();
			continue;
		}
		if (!isTransient(error) || ++spent > retries) {
			throw error;
		}
		await sleep(Math.max(backoff(spent), retryAfter(error)), signal);
		if (signal?.aborted) throw cancelled();
	}
};

// Files as entries with their full path in the folder: `<folder name>/<path>`. The folder
// name is `name`, else the top directory all paths share (as in an <input webkitdirectory>
// selection), else a default.
const folderEntries = (
	files: File[] | FolderEntry[],
	name?: string,
): ResolvedEntry[] => {
	if (!Array.isArray(files) || files.length === 0) {
		throw new ValidationError("A folder upload needs at least one file");
	}
	const split = files.map((item) => {
		// An entry's path may use "\\" as separator (a Windows path). A File's path never
		// does (webkitRelativePath uses "/"), so there "\\" is part of a name, which the
		// server refuses.
		const [file, path] = isFolderEntry(item)
			? [item.file, item.path.replace(/\\/g, "/")]
			: [item, item.webkitRelativePath || item.name];
		const segments = path.replace(/^(\.?\/)+/, "").split("/");
		if (segments.some((s) => s === "" || s === "." || s === "..")) {
			throw new ValidationError(`Invalid path in folder upload: "${path}"`);
		}
		return { file, segments };
	});

	const top = split[0].segments[0];
	const sharedTop = split.every(
		({ segments }) => segments.length > 1 && segments[0] === top,
	);
	const folder = name || (sharedTop ? top : DEFAULT_FOLDER_NAME);
	// One segment, checked as the input paths are
	if (/[/\\%]/.test(folder) || folder === "." || folder === "..") {
		throw new ValidationError(`Invalid folder name: "${folder}"`);
	}

	const seen = new Set<string>();
	return split.map(({ file, segments }, index) => {
		const path = [folder, ...(sharedTop ? segments.slice(1) : segments)].join(
			"/",
		);
		if (seen.has(path)) {
			throw new ValidationError(
				`Two files have the same path in the folder: "${path}"`,
			);
		}
		seen.add(path);
		return { index, path, file };
	});
};

const isFolderEntry = (item: File | FolderEntry): item is FolderEntry =>
	typeof (item as FolderEntry).path === "string" &&
	(item as FolderEntry).file !== undefined;

const rejectUnsupported = (options?: FolderUploadOptions) => {
	const unsupported = [
		options?.vectorize && "vectorize",
		options?.url && "url (signed upload URLs)",
		options?.car && "car",
		options?.streamable && "streamable",
		options?.peerAddresses && "peerAddress",
		options?.waitForCid === false && "waitForCid(false)",
	].filter(Boolean);
	if (unsupported.length > 0) {
		throw new ValidationError(
			`Folder uploads do not support: ${unsupported.join(", ")}`,
		);
	}
};

// Worth sending again: no answer, a timeout, a conflict with an upload of the same path still
// finishing, rate limiting and server errors.
const isTransient = (error: Error): boolean => {
	if (!(error instanceof PinataError)) return true; // fetch itself failed
	const status = error.statusCode;
	if (status === undefined) return false;
	return (
		status === 0 ||
		status === 408 ||
		status === 409 ||
		status === 425 ||
		status === 429 ||
		status >= 500
	);
};

// How long the server asked to wait before the next attempt (Retry-After), if it did
const retryAfter = (error: Error): number => {
	const ms =
		error instanceof PinataError
			? error.details?.metadata?.retryAfterMs
			: undefined;
	return typeof ms === "number" ? ms : 0;
};

const backoff = (attempt: number): number =>
	Math.min(1000 * 2 ** (attempt - 1), 10000) + Math.floor(Math.random() * 500);

// Runs at most `limit` tasks at a time, in the order they ask.
class Semaphore {
	private active = 0;
	private waiting: (() => void)[] = [];

	constructor(private readonly limit: number) {}

	async run<T>(task: () => Promise<T>): Promise<T> {
		if (this.active >= this.limit) {
			await new Promise<void>((resolve) => this.waiting.push(resolve));
		} else {
			this.active++;
		}
		try {
			return await task();
		} finally {
			const next = this.waiting.shift();
			if (next) next();
			else this.active--;
		}
	}
}

// A UUID version 7 (time-ordered), for the folder id.
const uuidv7 = (): string => {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	const time = Date.now();
	for (let i = 0; i < 6; i++) {
		bytes[i] = Math.floor(time / 2 ** (8 * (5 - i))) & 0xff;
	}
	bytes[6] = (bytes[6] & 0x0f) | 0x70;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
		"",
	);
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
