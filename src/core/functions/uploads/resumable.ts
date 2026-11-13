import {
	NetworkError,
	PinataError,
	ValidationError,
} from "../../../utils/custom-errors";
import type { CidVersion } from "../../types";
import { FileChunks } from "./fileChunks";
import {
	backoff,
	isFinalRefusal,
	parseRetryAfter,
	sleep,
	untilOnline,
} from "./retry";
import { largerThanSize } from "./streamChunks";
import { serverReason } from "./tusMetadata";
import {
	getUploadStatus,
	parseUploadOffset,
	type RequestHeaders,
	type StatusHint,
	type UploadStatus,
	resolveHeaders,
	waitForRegistration,
} from "./tusStatus";
import { refused, unreachable } from "./uploadErrors";

const CHUNK_SIZE = 50 * 1024 * 1024 + 1; // 50MB in bytes
const MAX_RETRIES = 5;

// A resumable (TUS) upload whose bytes the server has stored.
export interface StoredUpload {
	// The upload URL (TUS Location)
	url: string;
	// Upload-Cid, Upload-Status and Upload-Metadata of the response that completed it, or
	// of the lookup (HEAD) that found it complete
	cid: string | null;
	status: string | null;
	metadata: string | null;
	// `cid` was computed from this upload's bytes. Not when a lookup of a registered upload
	// gave it: that is the registered file's CID, an earlier upload's when this one matched it.
	ownCid: boolean;
	// What found the upload complete: the response to the request that completed it, or a
	// lookup (HEAD) after that response was lost or after a resume
	completedBy: "response" | "lookup";
}

export interface ResumableOptions {
	// A file that fits in one request travels with the creation request (TUS
	// creation-with-upload), so a small file takes one request instead of two
	inline?: boolean;
	// Cancels the upload: the request under way is aborted and it rejects with the reason
	signal?: AbortSignal;
	// The uploadUrl of an error an earlier call threw: that upload is continued from where
	// the server stands, if the server still has it; else a new upload is created
	resumeUrl?: string;
	// A chunk that gets no answer while the browser is offline waits until it is back
	// online, without counting as a retry. For uploads that can be cancelled (folder
	// uploads): otherwise it counts, so the upload fails after its retries.
	waitOnline?: boolean;
}

// Where a resumable upload is created: `base`, asking for `cidVersion` if given
export const creationUrl = (base: string, cidVersion?: CidVersion): string => {
	const url = new URL(base);
	if (cidVersion !== undefined) {
		url.searchParams.set("X-Upload-Option-Cid-Version", cidVersion.toString());
	}
	return url.toString();
};

// Creates a resumable upload at `createUrl` and sends every byte of `file`, resuming after
// failed chunks from the offset the server reports. Returns once the server has all of it.
export const sendResumable = async (
	createUrl: string,
	headers: RequestHeaders,
	file: File,
	metadata: string,
	{
		inline = false,
		signal,
		resumeUrl,
		waitOnline = false,
	}: ResumableOptions = {},
): Promise<StoredUpload> => {
	if (resumeUrl) {
		// null: the server no longer has the upload, or refuses to say: a new one is created
		const hint: StatusHint = {};
		const status = await getUploadStatus(
			resumeUrl,
			headers,
			file.size,
			signal,
			hint,
		).catch(() => null);
		if (signal?.aborted) throw signal.reason;
		// The server cannot tell now: keep the upload for the next attempt, after the pause
		// the server asked for (Retry-After), if it did
		if (status === undefined) {
			const message = "no answer about the upload to continue";
			const metadata = {
				requestUrl: resumeUrl,
				uploadUrl: resumeUrl,
				retryAfterMs: hint.retryAfterMs,
			};
			throw hint.status
				? new NetworkError(
						`The server could not say where the upload stands (HTTP ${hint.status})`,
						hint.status,
						{ error: message, code: "HTTP_ERROR", metadata },
					)
				: unreachable(message, metadata);
		}
		if (status) {
			return status.offset === file.size
				? storedFromStatus(resumeUrl, status)
				: sendChunks(
						resumeUrl,
						status.offset,
						headers,
						file,
						signal,
						waitOnline,
					);
		}
	}
	const withBody = inline && file.size > 0 && file.size <= CHUNK_SIZE;
	// The file is the body of the creation request, once its stream is found to hold exactly
	// its size: fs.openAsBlob() reports a file past 4 GiB modulo 2^32, and a body of `size`
	// bytes would complete a truncated upload. The SDK copies nothing: a file on disk is read
	// as it is sent (Node's fetch still holds the body it sent until the request ends). A
	// size of 0 completes the upload at once: the same check makes sure there are no bytes.
	if (withBody || file.size === 0) await assertSize(file);
	let urlReq: Response;
	try {
		urlReq = await fetch(createUrl, {
			method: "POST",
			headers: {
				"Upload-Length": `${file.size}`,
				"Upload-Metadata": metadata,
				...(withBody
					? { "Content-Type": "application/offset+octet-stream" }
					: {}),
				...resolveHeaders(headers),
				// RFC 7240: this client accepts that the server registers the file after the
				// last PATCH, and waits for `ready` (see waitForRegistration).
				Prefer: "respond-async",
			},
			...(withBody ? { body: file } : {}),
			signal,
		});
	} catch (error) {
		if (signal?.aborted) throw signal.reason;
		throw unreachable(error, { requestUrl: createUrl });
	}
	const url = urlReq.headers.get("Location");
	if (!url) {
		const errorData = await urlReq.text().catch(() => "");
		const errorMetadata = {
			requestUrl: urlReq.url,
			responseHeaders: Object.fromEntries(urlReq.headers),
			retryAfterMs: parseRetryAfter(urlReq.headers),
		};
		if (!urlReq.ok) {
			throw refused(
				"Could not start the upload",
				urlReq.status,
				errorData,
				errorMetadata,
			);
		}
		throw new NetworkError(
			`Upload URL not provided: the server answered ${urlReq.status} without a Location header`,
			urlReq.status,
			{ error: errorData, code: "HTTP_ERROR", metadata: errorMetadata },
		);
	}

	// The creation request stored the body, or the whole of an empty file.
	const offset = withBody
		? (parseUploadOffset(urlReq.headers, file.size) ?? 0)
		: 0;
	return offset === file.size
		? storedFromHeaders(url, urlReq.headers)
		: sendChunks(url, offset, headers, file, signal, waitOnline);
};

// Sends the bytes of `file` from `start` on to the upload at `url`, resuming after failed
// chunks from the offset the server reports. What it throws holds the upload's URL
// (uploadUrl) to continue it later.
const sendChunks = async (
	url: string,
	start: number,
	headers: RequestHeaders,
	file: File,
	signal?: AbortSignal,
	waitOnline = false,
): Promise<StoredUpload> => {
	let stored: StoredUpload = {
		url,
		cid: null,
		status: null,
		metadata: null,
		ownCid: false,
		completedBy: "response",
	};
	let offset = start;
	let failures = 0;
	// Not file.slice() alone: Node's Blob breaks past 2^32 bytes (see FileChunks).
	const chunks = new FileChunks(file, CHUNK_SIZE);

	try {
		while (offset < file.size) {
			// The rest of the chunk that holds `offset`: after a PATCH that stored only part
			// of a chunk, the next one resends the remainder.
			const chunk = await chunks.at(offset);
			const chunkLength =
				chunk instanceof Uint8Array ? chunk.byteLength : chunk.size;
			let failure: {
				status: number;
				error: string;
				requestUrl: string;
				retryAfterMs?: number;
			};

			try {
				const uploadReq = await fetch(url, {
					method: "PATCH",
					headers: {
						"Content-Type": "application/offset+octet-stream",
						"Upload-Offset": offset.toString(),
						...resolveHeaders(headers),
					},
					body: chunk,
					signal,
				});

				if (uploadReq.ok) {
					// The server's Upload-Offset wins over our own count: it can be lower than
					// the end of this chunk (only part of the body was stored) or the full length
					// (the server replayed an upload that had already finished).
					const next =
						parseUploadOffset(uploadReq.headers, file.size) ??
						offset + chunkLength;
					if (next > offset) {
						offset = next;
						failures = 0;
						if (offset === file.size) {
							stored = storedFromHeaders(url, uploadReq.headers);
						}
						continue;
					}
					failure = {
						status: uploadReq.status,
						error: "the server did not accept any bytes of the chunk",
						requestUrl: uploadReq.url || url,
					};
				} else {
					failure = {
						status: uploadReq.status,
						error: await uploadReq.text().catch(() => "Unknown error"),
						requestUrl: uploadReq.url || url,
						retryAfterMs: parseRetryAfter(uploadReq.headers),
					};
				}
			} catch (error) {
				if (signal?.aborted) throw signal.reason;
				failure = {
					status: 0,
					error: error instanceof Error ? error.message : String(error),
					requestUrl: url,
				};
			}

			// Offline in a browser: the attempt is not counted, and the next one waits until
			// the browser is back online
			const waited =
				waitOnline && failure.status === 0 && (await untilOnline(signal));
			if (signal?.aborted) throw signal.reason;
			if (!waited) {
				failures++;
				const final = isFinalRefusal(failure.status);
				if (final || failures > MAX_RETRIES) {
					const metadata = {
						requestUrl: failure.requestUrl,
						uploadUrl: url,
						uploadOffset: offset,
						...(final ? {} : { retriesAttempted: MAX_RETRIES }),
						retryAfterMs: failure.retryAfterMs,
					};
					// A refusal no retry can change (a refused JWT: an AuthenticationError)
					if (final) {
						throw refused(
							"Could not send the file",
							failure.status,
							failure.error,
							metadata,
						);
					}
					const reason =
						failure.status === 0 ? failure.error : serverReason(failure.error);
					const sent = failure.status
						? `Could not send the file (HTTP ${failure.status})`
						: "Could not reach the upload server while sending the file";
					throw new NetworkError(
						`${sent} after ${MAX_RETRIES} retries${reason ? `: ${reason}` : ""}`,
						failure.status,
						{
							error: failure.error,
							code: failure.status ? "HTTP_ERROR" : "NETWORK_ERROR",
							metadata,
						},
					);
				}
				// Unless the server asks for longer (Retry-After)
				await sleep(
					Math.max(backoff(failures), failure.retryAfterMs ?? 0),
					signal,
				);
				if (signal?.aborted) throw signal.reason;
			}

			// The failed PATCH may have been stored, in full or in part, before its
			// response was lost. Ask the server where the upload stands and continue
			// from there, instead of resending at our own offset (TUS: HEAD after a failure).
			let status: UploadStatus | undefined;
			const hint: StatusHint = {};
			try {
				status = await getUploadStatus(url, headers, file.size, signal, hint);
			} catch (error) {
				// The upload still exists (else 404 or 410): the next attempt continues it
				if (
					error instanceof PinataError &&
					error.statusCode !== 404 &&
					error.statusCode !== 410
				) {
					error.details = {
						...error.details,
						metadata: {
							...error.details?.metadata,
							uploadUrl: url,
							uploadOffset: offset,
						},
					};
				}
				throw error;
			}
			if (status) {
				// The server stored more of the upload, so this retry made progress. Reset
				// the retry budget and the backoff, as tus-js-client does.
				if (status.offset > offset) {
					failures = 0;
				}
				offset = status.offset;
				if (offset === file.size) {
					stored = storedFromStatus(url, status);
				}
			} else if (hint.retryAfterMs) {
				// The server can't say now and asks to wait before the next request
				await sleep(hint.retryAfterMs, signal);
				if (signal?.aborted) throw signal.reason;
			}
		}
	} finally {
		await chunks.close();
	}
	return stored;
};

// The upload at `url` as the response that completed it reports it: its CID is the one
// computed from its bytes
const storedFromHeaders = (url: string, headers: Headers): StoredUpload => {
	const cid = headers.get("upload-cid");
	return {
		url,
		cid,
		status: headers.get("upload-status"),
		metadata: headers.get("upload-metadata"),
		ownCid: cid !== null,
		completedBy: "response",
	};
};

// The upload at `url` as a lookup (HEAD) that found it complete reports it. Before
// registration the CID it reports is the one computed from the upload's bytes; once
// registered (`ready`, or a server that never sends Upload-Status) it is the registered
// file's.
const storedFromStatus = (url: string, status: UploadStatus): StoredUpload => ({
	url,
	cid: status.cid,
	status: status.status,
	metadata: status.metadata,
	ownCid:
		status.cid !== null && status.status !== null && status.status !== "ready",
	completedBy: "lookup",
});

// Throws unless the stream of `file` holds exactly `file.size` bytes. Reads it to the end
// and drops each piece once counted: sendResumable only calls it for files of one chunk.
const assertSize = async (file: Blob) => {
	const reader = file.stream().getReader();
	let read = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			read += value.byteLength;
			if (read > file.size) throw largerThanSize(file.size);
		}
	} finally {
		await reader.cancel().catch(() => undefined);
	}
	if (read < file.size) {
		throw new ValidationError(
			`The file is smaller than its reported size: its stream ended after ${read} of ${file.size} bytes`,
		);
	}
};

// A stored upload the server registered, and its CID
export type RegisteredUpload = StoredUpload & { cid: string };

// A server that sends Upload-Status registers the file after its last byte, and may
// already return the CID: only `ready` means the file can be looked up.
export const registersLater = (upload: StoredUpload): boolean =>
	upload.status !== null && upload.status !== "ready";

// Waits until a stored upload is registered (see waitForRegistration) and returns it with
// its own CID (the one computed from its bytes, else the registered file's) and the
// registered file's Upload-Metadata, which may be an earlier upload's. Throws if it has no
// CID. `pollMaxMs` caps the pause between two checks (see waitForRegistration).
export const registerResumable = async (
	upload: StoredUpload,
	headers: RequestHeaders,
	size: number,
	signal?: AbortSignal,
	pollMaxMs?: number,
): Promise<RegisteredUpload> => {
	let registered = upload;
	if (registersLater(upload)) {
		const ready = await waitForRegistration(
			upload.url,
			headers,
			size,
			signal,
			pollMaxMs,
		);
		registered = {
			...storedFromStatus(upload.url, ready),
			// The CID the server computed from these bytes, sent with the last of them, wins:
			// the ready status reports the registered file's, which is an earlier upload's
			// when this one matched it
			cid: upload.cid ?? ready.cid,
			ownCid: upload.cid !== null && upload.ownCid,
			completedBy: upload.completedBy,
		};
	}
	if (!registered.cid) {
		throw new NetworkError(
			"The server has every byte of the upload, but did not return its CID",
			0,
			{
				error: "missing upload-cid",
				code: "HTTP_ERROR",
				metadata: {
					requestUrl: upload.url,
				},
			},
		);
	}
	return { ...registered, cid: registered.cid };
};
