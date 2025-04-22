import type { PinataConfig, UploadResponse, UploadOptions } from "../../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const uploadFileArray = async (
	config: PinataConfig | undefined,
	files: File[],
	network: "public" | "private",
	options?: UploadOptions,
) => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	const jwt: string | undefined = options?.keys || config?.pinataJwt;

	const folder = options?.metadata?.name || "folder_from_sdk";

	const data = new FormData();

	for (const file of Array.from(files)) {
		const path = file.webkitRelativePath || `${folder}/${file.name}`;
		data.append("file", file, path);
	}

	// Reserved for later release
	// data.append("name", folder);

	// data.append("network", network);

	// if (options?.groupId) {
	//   data.append("group_id", options.groupId);
	// }

	// if (options?.metadata?.keyvalues) {
	//   data.append("keyvalues", JSON.stringify(options.metadata.keyvalues));
	// }

	// Legacy
	data.append(
		"pinataMetadata",
		JSON.stringify({
			name: folder,
			keyvalues: options?.metadata?.keyvalues,
		}),
	);

	data.append(
		"pinataOptions",
		JSON.stringify({
			groupId: options?.groupId,
			cidVersion: 1,
		}),
	);

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = {
			Authorization: `Bearer ${jwt}`,
			...config.customHeaders,
		};
	} else {
		headers = {
			Authorization: `Bearer ${jwt}`,
			Source: "sdk/fileArray",
		};
	}
	// Reserved for later release
	//let endpoint: string = "https://uploads.pinata.cloud/v3";
	let endpoint: string = "https://api.pinata.cloud/pinning/pinFileToIPFS";

	if (config.legacyUploadUrl) {
		endpoint = config.legacyUploadUrl;
	}

	try {
		// Reserved for later release
		// const request = await fetch(`${endpoint}/files`, {
		// 	method: "POST",
		// 	headers: headers,
		// 	body: data,
		// });
		const request = await fetch(`${endpoint}`, {
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

		const resData: UploadResponse = {
			id: res.ID,
			name: res.Name,
			cid: res.IpfsHash,
			size: res.PinSize,
			created_at: res.Timestamp,
			number_of_files: res.NumberOfFiles,
			mime_type: res.MimeType,
			group_id: res.GroupId,
			keyvalues: res.Keyvalues,
			vectorized: false,
			network: "public",
		};

		// if (options?.vectorize) {
		//   const vectorReq = await fetch(
		//     `${endpoint}/vectorize/files/${resData.id}`,
		//     {
		//       method: "POST",
		//       headers: {
		//         Authorization: `Bearer ${jwt}`,
		//       },
		//     },
		//   );
		//   if (vectorReq.ok) {
		//     resData.vectorized = true;
		//     return resData;
		//   } else {
		//     const errorData = await vectorReq.text();
		//     throw new NetworkError(
		//       `HTTP error during vectorization: ${errorData}`,
		//       vectorReq.status,
		//       {
		//         error: errorData,
		//         code: "HTTP_ERROR",
		//         metadata: {
		//           requestUrl: request.url,
		//         },
		//       },
		//     );
		//   }
		// }

		return resData;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing fileArray: ${error.message}`);
		}
		throw new PinataError(
			"An unknown error occurred while uploading an array of files",
		);
	}
};
