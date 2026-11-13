import {
	AuthenticationError,
	NetworkError,
} from "../../../utils/custom-errors";

const GIB = 1024 * 1024 * 1024;
// How long to wait for a finished upload to be registered. Processing a large file
// can take several minutes per GiB after its last byte arrives, so allow 5 minutes per
// GiB on top of the base (10 GB: 60 minutes).
export const REGISTRATION_TIMEOUT_BASE_MS = 10 * 60 * 1000;
export const REGISTRATION_TIMEOUT_PER_GIB_MS = 5 * 60 * 1000;
const REGISTRATION_POLL_MAX_MS = 10 * 1000;

// How long waitForRegistration waits for an upload of `size` bytes.
export const registrationTimeout = (size: number): number =>
	REGISTRATION_TIMEOUT_BASE_MS +
	Math.ceil(size / GIB) * REGISTRATION_TIMEOUT_PER_GIB_MS;

export interface UploadStatus {
	offset: number;
	cid: string | null;
	// TUS Upload-Status: receiving, processing, ready or failed. Null on servers that
	// complete an upload on its last PATCH and never send it.
	status: string | null;
	// Why a `failed` upload failed, when the server says (Upload-Error)
	error: string | null;
	// TUS Upload-Metadata: once the file is registered, the server may report its id
	// (file_id) and name (filename) there
	metadata: string | null;
}

// Reads a TUS Upload-Offset header. Returns undefined unless it is a whole
// number between 0 and the file size.
export const parseUploadOffset = (
	headers: Headers,
	size: number,
): number | undefined => {
	const value = headers.get("upload-offset");
	if (value === null || !/^\d+$/.test(value)) {
		return undefined;
	}
	const offset = Number(value);
	return Number.isSafeInteger(offset) && offset <= size ? offset : undefined;
};

// Request headers, or a function that builds them for each request: a token replaced
// meanwhile (setNewJwt) is then used from the next request on.
export type RequestHeaders =
	| Record<string, string>
	| (() => Record<string, string>);

export const resolveHeaders = (
	headers: RequestHeaders,
): Record<string, string> =>
	typeof headers === "function" ? headers() : headers;

// Asks the server how much of a resumable upload it has stored (TUS HEAD).
// Returns undefined when the server cannot tell right now, so the caller retries
// at its own offset. Throws when no retry can succeed: the upload no longer exists,
// or the server refuses to look it up for good.
export const getUploadStatus = async (
	url: string,
	headers: RequestHeaders,
	size: number,
	signal?: AbortSignal,
): Promise<UploadStatus | undefined> => {
	let res: Response;
	try {
		res = await fetch(url, {
			method: "HEAD",
			headers: resolveHeaders(headers),
			signal,
		});
	} catch {
		return undefined;
	}
	if (res.status === 404 || res.status === 410) {
		throw new NetworkError(
			"The upload no longer exists on the server",
			res.status,
			{
				error: `HEAD returned ${res.status}`,
				code: "HTTP_ERROR",
				metadata: {
					requestUrl: res.url || url,
				},
			},
		);
	}
	// No later request can succeed with these credentials: say so now, rather than
	// polling until the registration wait runs out
	if (res.status === 401 || res.status === 403) {
		throw new AuthenticationError(
			`Authentication failed while checking the upload (HTTP ${res.status})`,
			res.status,
			{
				error: `HEAD returned ${res.status}`,
				code: "AUTH_ERROR",
				metadata: { requestUrl: res.url || url },
			},
		);
	}
	// Asking again cannot change a refusal other than a timeout, a conflict or a rate
	// limit (a name the server cannot address answers 400 to every HEAD)
	if (
		res.status >= 400 &&
		res.status < 500 &&
		![408, 409, 423, 425, 429].includes(res.status)
	) {
		throw new NetworkError(
			`The server refused to look up the upload (HTTP ${res.status})`,
			res.status,
			{
				error: `HEAD returned ${res.status}`,
				code: "HTTP_ERROR",
				metadata: { requestUrl: res.url || url },
			},
		);
	}
	if (!res.ok) {
		return undefined;
	}
	const offset = parseUploadOffset(res.headers, size);
	if (offset === undefined) {
		return undefined;
	}
	return {
		offset,
		cid: res.headers.get("upload-cid"),
		status: res.headers.get("upload-status"),
		error: res.headers.get("upload-error"),
		metadata: res.headers.get("upload-metadata"),
	};
};

// Some servers answer the request that completes an upload before the file is
// registered (Upload-Status: processing), sometimes already with its Upload-Cid. The
// file can only be looked up once HEAD reports `ready`; until then registration can
// still fail. Polls HEAD until then and returns that `ready` status (its CID is null if
// `ready` came without one). `signal` stops the wait: it rejects with the abort reason.
// The pause between two checks starts at 1 s and doubles up to `pollMaxMs`.
export const waitForRegistration = async (
	url: string,
	headers: RequestHeaders,
	size: number,
	signal?: AbortSignal,
	pollMaxMs = REGISTRATION_POLL_MAX_MS,
): Promise<UploadStatus> => {
	const timeout = registrationTimeout(size);
	const deadline = Date.now() + timeout;
	let delay = Math.min(1000, pollMaxMs);
	while (Date.now() + delay <= deadline) {
		await new Promise<void>((resolve, reject) => {
			if (signal?.aborted) return reject(signal.reason);
			const onAbort = () => {
				clearTimeout(timer);
				reject(signal?.reason);
			};
			const timer = setTimeout(() => {
				signal?.removeEventListener("abort", onAbort);
				resolve();
			}, delay);
			signal?.addEventListener("abort", onAbort, { once: true });
		});
		delay = Math.min(delay * 2, pollMaxMs);
		const status = await getUploadStatus(url, headers, size, signal);
		if (signal?.aborted) throw signal.reason;
		// `ready` is final: without a CID the caller reports the missing CID.
		if (status?.status === "ready") {
			return status;
		}
		if (status?.status === "failed") {
			// Upload-Error is optional: a server may report the failure without a reason.
			throw new NetworkError(
				`The upload was received but not registered${status.error ? `: ${status.error}` : ""}`,
				422,
				{
					error: status.error || "upload failed",
					code: "HTTP_ERROR",
					metadata: {
						requestUrl: url,
					},
				},
			);
		}
	}
	// Not a failure of the upload: the server has every byte and may still register it.
	throw new NetworkError(
		`Timed out waiting for the upload to be registered after ${Math.round(timeout / 60000)} minutes. ` +
			`The server has every byte and is still processing it, so it may yet be registered: poll ${url} ` +
			"with HEAD until it returns Upload-Status: ready (its Upload-Cid header then holds the CID) " +
			"or failed.",
		0,
		{
			error: "upload still processing",
			code: "HTTP_ERROR",
			metadata: {
				requestUrl: url,
				timeoutMs: timeout,
			},
		},
	);
};
