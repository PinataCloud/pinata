import type { PinataConfig, UploadResponse, UploadOptions } from "../../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

// Reads a TUS Upload-Offset header. Returns undefined unless it is a whole
// number between 0 and the file size.
const parseUploadOffset = (
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
const getUploadStatus = async (
	url: string,
	headers: Record<string, string>,
	size: number,
): Promise<{ offset: number; cid: string | null } | undefined> => {
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
	return { offset, cid: res.headers.get("upload-cid") };
};

export const uploadFile = async (
	config: PinataConfig | undefined,
	file: File,
	network: "public" | "private",
	options?: UploadOptions,
) => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	const jwt: string | undefined = options?.keys || config.pinataJwt;

	let endpoint: string = "https://uploads.pinata.cloud/v3";

	if (config.uploadUrl) {
		endpoint = config.uploadUrl;
	}

	if (file.size > 94371840) {
		let headers: Record<string, string>;

		if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
			headers = {
				Authorization: `Bearer ${jwt}`,
				...config.customHeaders,
			};
		} else {
			headers = {
				Authorization: `Bearer ${jwt}`,
				Source: "sdk/file",
			};
		}

		const name = options?.metadata?.name || file.name || "File from SDK";

		let metadata: string = `filename ${btoa(name)},filetype ${btoa(file.type)},network ${btoa(network)}`;

		if (options?.groupId) {
			metadata += `,group_id ${btoa(options.groupId)}`;
		}

		if (options?.metadata?.keyvalues) {
			metadata += `,keyvalues ${btoa(JSON.stringify(options.metadata.keyvalues))}`;
		}

		if (options?.streamable) {
			metadata += `,streamable ${btoa("true")}`;
		}

		if (options?.car) {
			metadata += `,car ${btoa("true")}`;
		}

		if (options?.cid_version !== undefined) {
			metadata += `,cid_version ${btoa(options.cid_version)}`;
		}

		if (options?.expires_at !== undefined) {
			metadata += `,expires_at ${btoa(options.expires_at.toString())}`;
		}

		// Build URL with query parameters for chunked uploads
		let updatedEndpoint: string = `${endpoint}/files`;
		if (options?.url) {
			updatedEndpoint = options.url;
		}

		const requestUrl = new URL(updatedEndpoint);
		if (options?.cid_version !== undefined) {
			requestUrl.searchParams.set(
				"X-Upload-Option-Cid-Version",
				options.cid_version.toString(),
			);
		}

		const urlReq = await fetch(requestUrl.toString(), {
			method: "POST",
			headers: {
				"Upload-Length": `${file.size}`,
				"Upload-Metadata": metadata,
				...headers,
			},
		});
		const url = urlReq.headers.get("Location");
		if (!url) {
			const errorData = await urlReq.text();
			throw new NetworkError("Upload URL not provided", urlReq.status, {
				error: errorData,
				code: "HTTP_ERROR",
				metadata: {
					requestUrl: urlReq.url,
					requestHeaders: urlReq.headers,
				},
			});
		}

		const chunkSize = 50 * 1024 * 1024 + 1; // 50MB in bytes
		const maxRetries = 5;
		let offset = 0;
		let failures = 0;
		let cid: string | null = null;

		while (offset < file.size) {
			const chunk = file.slice(offset, offset + chunkSize);
			let failure: { status: number; error: string; requestUrl: string };

			try {
				const uploadReq = await fetch(url, {
					method: "PATCH",
					headers: {
						"Content-Type": "application/offset+octet-stream",
						"Upload-Offset": offset.toString(),
						...headers,
					},
					body: chunk,
				});

				if (uploadReq.ok) {
					// The server's Upload-Offset wins over our own count: it can be lower than
					// the end of this chunk (only part of the body was stored) or the full length
					// (the server replayed an upload that had already finished).
					const next =
						parseUploadOffset(uploadReq.headers, file.size) ??
						offset + chunk.size;
					if (next > offset) {
						offset = next;
						failures = 0;
						if (offset === file.size) {
							cid = uploadReq.headers.get("upload-cid");
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
					};
				}
			} catch (error) {
				failure = {
					status: 0,
					error: error instanceof Error ? error.message : String(error),
					requestUrl: url,
				};
			}

			failures++;
			if (failures > maxRetries) {
				throw new NetworkError(
					`HTTP error during chunk upload after ${maxRetries} retries: ${failure.error}`,
					failure.status,
					{
						error: failure.error,
						code: "HTTP_ERROR",
						metadata: {
							requestUrl: failure.requestUrl,
							retriesAttempted: maxRetries,
						},
					},
				);
			}
			const delay = Math.min(1000 * Math.pow(2, failures - 1), 10000); // Cap at 10 seconds
			await new Promise((resolve) => setTimeout(resolve, delay));

			// The failed PATCH may have been stored, in full or in part, before its
			// response was lost. Ask the server where the upload stands and continue
			// from there, instead of resending at our own offset (TUS: HEAD after a failure).
			const status = await getUploadStatus(url, headers, file.size);
			if (status) {
				// The server stored more of the upload, so this retry made progress. Reset
				// the retry budget and the backoff, as tus-js-client does.
				if (status.offset > offset) {
					failures = 0;
				}
				offset = status.offset;
				if (offset === file.size) {
					cid = status.cid;
				}
			}
		}

		if (!cid) {
			throw new NetworkError(
				"The server has every byte of the upload, but did not return its CID",
				0,
				{
					error: "missing upload-cid",
					code: "HTTP_ERROR",
					metadata: {
						requestUrl: url,
					},
				},
			);
		}

		if (!config.pinataJwt) {
			const data: UploadResponse = {
				id: "",
				name: "",
				cid: cid,
				size: file.size,
				created_at: "",
				number_of_files: 1,
				group_id: null,
				mime_type: "",
				keyvalues: {},
				vectorized: false,
				network: "",
			};
			return data;
		}
		let dataEndpoint: string;
		if (config.endpointUrl) {
			dataEndpoint = config.endpointUrl;
		} else {
			dataEndpoint = "https://api.pinata.cloud/v3";
		}
		const fileInfoReq = await fetch(
			`${dataEndpoint}/files/${network}?cid=${cid}`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${jwt}`,
				},
			},
		);
		const fileInfo = await fileInfoReq.json();
		const data: UploadResponse = fileInfo.data.files[0];
		if (options?.vectorize) {
			const vectorReq = await fetch(`${endpoint}/vectorize/files/${data.id}`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${jwt}`,
				},
			});
			if (vectorReq.ok) {
				data.vectorized = true;
				return data;
			} else {
				const errorData = await vectorReq.text();
				throw new NetworkError(
					`HTTP error during vectorization: ${errorData}`,
					vectorReq.status,
					{
						error: errorData,
						code: "HTTP_ERROR",
						metadata: {
							requestUrl: vectorReq.url,
						},
					},
				);
			}
		}
		return data;
	}

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = {
			Authorization: `Bearer ${jwt}`,
			...config.customHeaders,
		};
	} else {
		headers = {
			Authorization: `Bearer ${jwt}`,
			Source: "sdk/file",
		};
	}

	const data = new FormData();
	data.append("file", file, file.name);

	data.append("network", network);

	data.append("name", options?.metadata?.name || file.name || "File from SDK");

	if (options?.groupId) {
		data.append("group_id", options.groupId);
	}

	if (options?.metadata?.keyvalues) {
		data.append("keyvalues", JSON.stringify(options.metadata.keyvalues));
	}

	if (options?.streamable) {
		data.append("streamable", "true");
	}

	if (options?.car) {
		data.append("car", "true");
	}

	if (options?.cid_version !== undefined) {
		data.append("cid_version", options.cid_version.toString());
	}

	if (options?.expires_at !== undefined) {
		data.append("expires_at", options.expires_at.toString());
	}

	if (options?.url) {
		try {
			const url = new URL(options.url);

			const request = await fetch(url.toString(), {
				method: "POST",
				headers: headers,
				body: data,
			});

			if (!request.ok) {
				const errorData = await request.text();
				if (request.status === 401 || request.status === 403) {
					throw new AuthenticationError(
						`Authentication failed: ${errorData}`,
						request.status,
						{
							error: errorData,
							code: "AUTH_ERROR",
							metadata: {
								requestUrl: request.url,
							},
						},
					);
				}
				throw new NetworkError(`HTTP error: ${errorData}`, request.status, {
					error: errorData,
					code: "HTTP_ERROR",
					metadata: {
						requestUrl: request.url,
					},
				});
			}

			const res = await request.json();
			const resData: UploadResponse = res.data;
			return resData;
		} catch (error) {
			if (error instanceof PinataError) {
				throw error;
			}
			if (error instanceof Error) {
				throw new PinataError(
					`Error uploading file: ${error.message}`,
					undefined,
					{
						error: error.toString(),
					},
				);
			}
			throw new PinataError(
				"An unknown error occurred while trying to upload file",
			);
		}
	}

	try {
		const request = await fetch(`${endpoint}/files`, {
			method: "POST",
			headers: headers,
			body: data,
		});

		if (!request.ok) {
			const errorData = await request.text();
			if (request.status === 401 || request.status === 403) {
				throw new AuthenticationError(
					`Authentication failed: ${errorData}`,
					request.status,
					{
						error: errorData,
						code: "AUTH_ERROR",
						metadata: {
							requestUrl: request.url,
						},
					},
				);
			}
			throw new NetworkError(`HTTP error: ${errorData}`, request.status, {
				error: errorData,
				code: "HTTP_ERROR",
				metadata: {
					requestUrl: request.url,
				},
			});
		}
		const res = await request.json();
		const resData: UploadResponse = res.data;
		if (options?.vectorize) {
			const vectorReq = await fetch(
				`${endpoint}/vectorize/files/${resData.id}`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${jwt}`,
					},
				},
			);
			if (vectorReq.ok) {
				resData.vectorized = true;
				return resData;
			} else {
				const errorData = await vectorReq.text();
				throw new NetworkError(
					`HTTP error during vectorization: ${errorData}`,
					vectorReq.status,
					{
						error: errorData,
						code: "HTTP_ERROR",
						metadata: {
							requestUrl: request.url,
						},
					},
				);
			}
		}
		return resData;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(
				`Error uploading file: ${error.message}`,
				undefined,
				{
					error: error.toString(),
				},
			);
		}
		throw new PinataError(
			"An unknown error occurred while trying to upload file",
		);
	}
};
