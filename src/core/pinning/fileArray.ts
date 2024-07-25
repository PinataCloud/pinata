/**
 * Uploads multiple file types
 * @returns message
 */

import type { PinataConfig, PinResponse, UploadOptions } from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const uploadFileArray = async (
	config: PinataConfig | undefined,
	files: File[],
	options?: UploadOptions,
) => {
	if (!config || !config.pinataJwt) {
		throw new ValidationError("Pinata configuration or JWT is missing");
	}

	const jwt: string = options?.keys || config?.pinataJwt;

	const folder = options?.metadata?.name ?? "folder_from_sdk";
	const data = new FormData();

	for (const file of Array.from(files)) {
		data.append("file", file, `${folder}/${file.name}`);
	}

	data.append(
		"pinataMetadata",
		JSON.stringify({
			name: folder,
			keyvalues: options?.metadata?.keyValues,
		}),
	);

	data.append(
		"pinataOptions",
		JSON.stringify({
			cidVersion: options?.cidVersion,
			groupId: options?.groupId,
		}),
	);

	try {
		const request = await fetch(
			"https://api.pinata.cloud/pinning/pinFileToIPFS",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${jwt}`,
				},
				body: data,
			},
		);

		if (!request.ok) {
			const errorData = await request.json();
			if (request.status === 401) {
				throw new AuthenticationError(
					"Authentication failed",
					request.status,
					errorData,
				);
			}
			throw new NetworkError(
				`HTTP error! status: ${request.status}`,
				request.status,
				errorData,
			);
		}

		const res: PinResponse = await request.json();
		return res;
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
