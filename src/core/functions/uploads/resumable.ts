import { NetworkError, PinataError } from "../../../utils/custom-errors";
import { FileChunks } from "./fileChunks";
import { serverReason } from "./tusMetadata";
import { parseRetryAfter, sleep, untilOnline } from "./wait";
import {
	getUploadStatus,
	parseUploadOffset,
	type RequestHeaders,
	type UploadStatus,
	resolveHeaders,
	waitForRegistration,
} from "./tusStatus";

const CHUNK_SIZE = 50 * 1024 * 1024 + 1; // 50MB in bytes
const MAX_RETRIES = 5;

// A resumable (TUS) upload whose bytes the server has stored.
export interface StoredUpload {
	// The upload URL (TUS Location)
	url: string;
	// Upload-Cid, Upload-Status and Upload-Metadata of the response that completed it
	cid: string | null;
	status: string | null;
	metadata: string | null;
}

// Creates a resumable upload at `createUrl` and sends every byte of `file`, resuming after
// failed chunks from the offset the server reports. Returns once the server has all of it.
// With `inline`, a file that fits in one request travels with the creation request
// (TUS creation-with-upload), so a small file takes one request instead of two.
// `signal` cancels it: the request under way is aborted and it rejects with the reason.
// `resumeUrl`, the uploadUrl of an error an earlier call threw, continues that upload from
// where the server stands, if the server still has it; else a new upload is created.
export const sendResumable = async (
	createUrl: string,
	headers: RequestHeaders,
	file: File,
	metadata: string,
	inline = false,
	signal?: AbortSignal,
	resumeUrl?: string,
): Promise<StoredUpload> => {
	if (resumeUrl) {
		// null: the server no longer has the upload, or refuses to say: a new one is created
		const status = await getUploadStatus(
			resumeUrl,
			headers,
			file.size,
			signal,
		).catch(() => null);
		if (signal?.aborted) throw signal.reason;
		// The server cannot tell now: keep the upload for the next attempt
		if (status === undefined) {
			const error = unreachable(
				"no answer about the upload to continue",
				resumeUrl,
			);
			error.details = {
				...error.details,
				metadata: { requestUrl: resumeUrl, uploadUrl: resumeUrl },
			};
			throw error;
		}
		if (status) {
			const upload: StoredUpload = {
				url: resumeUrl,
				cid: status.cid,
				status: status.status,
				metadata: status.metadata,
			};
			return status.offset === file.size
				? upload
				: sendChunks(upload, status.offset, headers, file, signal);
		}
	}
	const withBody = inline && file.size > 0 && file.size <= CHUNK_SIZE;
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
		throw unreachable(error, createUrl);
	}
	const url = urlReq.headers.get("Location");
	if (!url) {
		const errorData = await urlReq.text().catch(() => "");
		const reason = serverReason(errorData);
		throw new NetworkError(
			urlReq.ok
				? `Upload URL not provided: the server answered ${urlReq.status} without a Location header`
				: `Could not start the upload (HTTP ${urlReq.status})${reason ? `: ${reason}` : ""}`,
			urlReq.status,
			{
				error: errorData,
				code: "HTTP_ERROR",
				metadata: {
					requestUrl: urlReq.url,
					requestHeaders: urlReq.headers,
					retryAfterMs: parseRetryAfter(urlReq.headers),
				},
			},
		);
	}

	const upload: StoredUpload = { url, cid: null, status: null, metadata: null };
	// The creation request stored the body, or the whole of an empty file.
	let offset = withBody
		? (parseUploadOffset(urlReq.headers, file.size) ?? 0)
		: 0;
	if (offset === file.size) {
		upload.cid = urlReq.headers.get("upload-cid");
		upload.status = urlReq.headers.get("upload-status");
		upload.metadata = urlReq.headers.get("upload-metadata");
		return upload;
	}
	return sendChunks(upload, offset, headers, file, signal);
};

// Sends the bytes of `file` from `offset` on to the upload, resuming after failed chunks
// from the offset the server reports. What it throws holds the upload's URL (uploadUrl) to
// continue it later.
const sendChunks = async (
	upload: StoredUpload,
	start: number,
	headers: RequestHeaders,
	file: File,
	signal?: AbortSignal,
): Promise<StoredUpload> => {
	const { url } = upload;
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
							upload.cid = uploadReq.headers.get("upload-cid");
							upload.status = uploadReq.headers.get("upload-status");
							upload.metadata = uploadReq.headers.get("upload-metadata");
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
			const waited = failure.status === 0 && (await untilOnline(signal));
			if (signal?.aborted) throw signal.reason;
			if (!waited) {
				failures++;
				const reason =
					failure.status === 0 ? failure.error : serverReason(failure.error);
				const sent = failure.status
					? `Could not send the file (HTTP ${failure.status})`
					: "Could not reach the upload server while sending the file";
				// A refusal that sending again cannot change (a 4xx other than a timeout, a
				// conflict or a rate limit) fails at once
				const permanent =
					failure.status >= 400 &&
					failure.status < 500 &&
					![408, 409, 423, 425, 429].includes(failure.status);
				if (permanent || failures > MAX_RETRIES) {
					throw new NetworkError(
						`${sent}${permanent ? "" : ` after ${MAX_RETRIES} retries`}${reason ? `: ${reason}` : ""}`,
						failure.status,
						{
							error: failure.error,
							code: failure.status ? "HTTP_ERROR" : "NETWORK_ERROR",
							metadata: {
								requestUrl: failure.requestUrl,
								uploadUrl: url,
								uploadOffset: offset,
								...(permanent ? {} : { retriesAttempted: MAX_RETRIES }),
								retryAfterMs: failure.retryAfterMs,
							},
						},
					);
				}
				// Cap at 10 seconds, unless the server asks for longer (Retry-After)
				const delay = Math.max(
					Math.min(1000 * Math.pow(2, failures - 1), 10000),
					failure.retryAfterMs ?? 0,
				);
				await sleep(delay, signal);
				if (signal?.aborted) throw signal.reason;
			}

			// The failed PATCH may have been stored, in full or in part, before its
			// response was lost. Ask the server where the upload stands and continue
			// from there, instead of resending at our own offset (TUS: HEAD after a failure).
			let status: UploadStatus | undefined;
			try {
				status = await getUploadStatus(url, headers, file.size, signal);
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
					upload.cid = status.cid;
					upload.status = status.status;
					upload.metadata = status.metadata;
				}
			}
		}
	} finally {
		await chunks.close();
	}
	return upload;
};

// What a request that got no answer (offline, DNS, connection reset) fails with
const unreachable = (error: unknown, requestUrl: string) => {
	const message = error instanceof Error ? error.message : String(error);
	return new NetworkError(`Could not reach the upload server: ${message}`, 0, {
		error: message,
		code: "NETWORK_ERROR",
		metadata: { requestUrl },
	});
};

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
): Promise<StoredUpload> => {
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
			url: upload.url,
			// The CID the server computed from these bytes, sent with the last of them, wins:
			// the ready status reports the registered file's, which is an earlier upload's
			// when this one matched it (files-tus checks the two agree for this upload)
			cid: upload.cid ?? ready.cid,
			status: ready.status,
			metadata: ready.metadata,
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
	return registered;
};
