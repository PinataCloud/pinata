import type { PinataConfig, UploadResponse, UploadOptions } from "../../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

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
			metadata + `,group_id ${btoa(options.groupId)}`;
		}

		if (options?.metadata?.keyvalues) {
			metadata +
				`,keyvalues ${btoa(JSON.stringify(options.metadata.keyvalues))}`;
		}

		if (options?.streamable) {
			metadata + `,keyvalues ${btoa("true")}`;
		}

		let updatedEndpoint: string = `${endpoint}/files`;

		if (options?.url) {
			updatedEndpoint = options.url;
		}

		const urlReq = await fetch(updatedEndpoint, {
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

		const chunkSize = 50 * 1024 * 1024; // 50MB in bytes
		const totalChunks = Math.ceil(file.size / chunkSize);
		let offset = 0;
		let uploadReq: any;

		for (let i = 0; i < totalChunks; i++) {
			const chunk = file.slice(offset, offset + chunkSize);
			let retryCount = 0;
			const maxRetries = 5;

			while (retryCount <= maxRetries) {
				try {
					uploadReq = await fetch(url as string, {
						method: "PATCH",
						headers: {
							"Content-Type": "application/offset+octet-stream",
							"Upload-Offset": offset.toString(),
							...headers,
						},
						body: chunk,
					});

					if (uploadReq.ok) {
						break;
					} else {
						const errorData = await uploadReq.text();
						throw new Error(`HTTP ${uploadReq.status}: ${errorData}`);
					}
				} catch (error) {
					retryCount++;

					if (retryCount > maxRetries) {
						// All retries exhausted - throw final error
						const errorData = uploadReq
							? await uploadReq.text().catch(() => "Unknown error")
							: error instanceof Error
								? error.message
								: String(error);
						throw new NetworkError(
							`HTTP error during chunk upload after ${maxRetries} retries: ${errorData}`,
							uploadReq?.status || 0,
							{
								error: errorData,
								code: "HTTP_ERROR",
								metadata: {
									requestUrl: uploadReq?.url || url,
									retriesAttempted: maxRetries,
								},
							},
						);
					}
					const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000); // Cap at 10 seconds
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
			offset += chunk.size;
		}

		if (uploadReq.status === 204) {
			const cid = uploadReq.headers.get("upload-cid");
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
				const vectorReq = await fetch(
					`${endpoint}/vectorize/files/${data.id}`,
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${jwt}`,
						},
					},
				);
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

	if (options?.url) {
		try {
			const request = await fetch(options.url, {
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
