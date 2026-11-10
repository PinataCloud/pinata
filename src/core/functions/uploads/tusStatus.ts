import { NetworkError } from "../../../utils/custom-errors";

const GIB = 1024 * 1024 * 1024;
// How long to wait for a finished upload to be registered: the server hashes the stored
// copy first, which takes about half a minute per GiB.
const REGISTRATION_TIMEOUT_BASE_MS = 10 * 60 * 1000;
const REGISTRATION_TIMEOUT_PER_GIB_MS = 60 * 1000;
const REGISTRATION_POLL_MAX_MS = 10 * 1000;

export interface UploadStatus {
	offset: number;
	cid: string | null;
	// TUS Upload-Status: receiving, processing, ready or failed. Null on servers that
	// complete an upload on its last PATCH and never send it.
	status: string | null;
	error: string | null;
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

// Asks the server how much of a resumable upload it has stored (TUS HEAD).
// Returns undefined when the server cannot tell right now, so the caller retries
// at its own offset. Throws when the upload no longer exists, because no retry
// can succeed then.
export const getUploadStatus = async (
	url: string,
	headers: Record<string, string>,
	size: number,
): Promise<UploadStatus | undefined> => {
	let res: Response;
	try {
		res = await fetch(url, { method: "HEAD", headers });
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
	};
};

// Some servers answer the request that completes an upload before the file is
// registered (Upload-Status: processing), sometimes already with its Upload-Cid. The
// file can only be looked up once HEAD reports `ready`; until then registration can
// still fail. Polls HEAD until then and returns the registered CID (null if `ready`
// came without one).
export const waitForRegistration = async (
	url: string,
	headers: Record<string, string>,
	size: number,
): Promise<string | null> => {
	const deadline =
		Date.now() +
		REGISTRATION_TIMEOUT_BASE_MS +
		Math.ceil(size / GIB) * REGISTRATION_TIMEOUT_PER_GIB_MS;
	let delay = 1000;
	while (Date.now() + delay <= deadline) {
		await new Promise((resolve) => setTimeout(resolve, delay));
		delay = Math.min(delay * 2, REGISTRATION_POLL_MAX_MS);
		const status = await getUploadStatus(url, headers, size);
		// `ready` is final: without a CID the caller reports the missing CID.
		if (status?.status === "ready") {
			return status.cid;
		}
		if (status?.status === "failed") {
			throw new NetworkError(
				`The upload was received but not registered: ${status.error || "processing failed"}`,
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
	throw new NetworkError(
		"Timed out waiting for the upload to be registered",
		0,
		{
			error: "upload still processing",
			code: "HTTP_ERROR",
			metadata: {
				requestUrl: url,
			},
		},
	);
};
