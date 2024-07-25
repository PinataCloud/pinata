/**
 * Uploads multiple file types
 * @returns message
 */

import type {
	PinataConfig,
	PinResponse,
	UploadOptions,
	JsonBody,
} from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const uploadJson = async <T extends JsonBody>(
	config: PinataConfig | undefined,
	jsonData: T,
	options?: UploadOptions,
) => {
	if (!config || !config.pinataJwt) {
		throw new ValidationError("Pinata configuration or JWT is missing");
	}

	const jwt: string = options?.keys || config?.pinataJwt;

	const data = JSON.stringify({
		pinataContent: jsonData,
		pinataOptions: {
			cidVersion: options?.cidVersion,
			groupId: options?.groupId,
		},
		pinataMetadata: {
			name: options?.metadata ? options.metadata.name : "json",
			keyvalues: options?.metadata?.keyValues,
		},
	});

	try {
		const request = await fetch(
			"https://api.pinata.cloud/pinning/pinJSONToIPFS",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
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
			throw new PinataError(`Error processing json: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while uploading json");
	}
};
