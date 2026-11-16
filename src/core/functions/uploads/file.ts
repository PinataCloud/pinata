import type { PinataConfig, UploadResponse, UploadOptions } from "../../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";
import {
	creationUrl,
	registerResumable,
	registersLater,
	sendResumable,
} from "./resumable";
import {
	fileMetadata,
	optionsMetadata,
	parseUploadMetadata,
} from "./tusMetadata";

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
		// Checked here, before any request: waitForCid only applies to these uploads.
		if (options?.waitForCid === false && options.vectorize) {
			throw new ValidationError(
				"waitForCid: false cannot be combined with vectorize, which needs the registered file",
			);
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

		const name = options?.metadata?.name || file.name || "File from SDK";
		const stored = await sendResumable(
			creationUrl(options?.url || `${endpoint}/files`, options?.cid_version),
			headers,
			file,
			`${fileMetadata(name, file.type)},${optionsMetadata(network, options)}`,
		);
		const skipWait = registersLater(stored) && options?.waitForCid === false;
		const registered = skipWait
			? stored
			: await registerResumable(stored, headers, file.size);
		const cid = registered.cid;
		const completion = registered.metadata;

		// Without the registered file to look up (no JWT, or waitForCid: false), return
		// what the upload itself reported. A server that registered the file can report its
		// id and name in Upload-Metadata: that may be an earlier file with the same content,
		// so they are only taken from there, never from the request. Not the type: the server's
		// Upload-Content-Type is detected from this upload, even when it returns an earlier file.
		if (!config.pinataJwt || skipWait) {
			const reported = parseUploadMetadata(completion);
			const known = reported.file_id !== undefined;
			const data: UploadResponse = {
				id: known ? reported.file_id : "",
				name: known ? (reported.filename ?? "") : "",
				cid: cid ?? "",
				size: file.size,
				created_at: "",
				number_of_files: 1,
				group_id: null,
				mime_type: "",
				keyvalues: {},
				vectorized: false,
				network,
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
