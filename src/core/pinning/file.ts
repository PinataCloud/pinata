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

export const uploadFile = async (
	config: PinataConfig | undefined,
	file: File,
	options?: UploadOptions,
) => {
	if (!config || !config.pinataJwt) {
		throw new ValidationError("Pinata configuration or JWT is missing");
	}

	const jwt: string = options?.keys || config.pinataJwt;

	const data = new FormData();
	data.append("file", file, file.name);

	data.append(
		"pinataOptions",
		JSON.stringify({
			cidVersion: options?.cidVersion,
			groupId: options?.groupId,
		}),
	);

	data.append(
		"pinataMetadata",
		JSON.stringify({
			name: options?.metadata ? options.metadata.name : file.name,
			keyvalues: options?.metadata?.keyValues,
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
			throw new PinataError(`Error uploading file: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while uploading the file");
	}
};
