/**
 * Uploads multiple file types
 * @returns message
 */

import type { PinataConfig, PinataMetadataUpdate } from "../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const updateMetadata = async (
	config: PinataConfig | undefined,
	options: PinataMetadataUpdate,
): Promise<string> => {
	if (!config || !config.pinataJwt) {
		throw new ValidationError("Pinata configuration or JWT is missing");
	}
	const data = {
		ipfsPinHash: options.cid,
		name: options.name,
		keyvalues: options.keyValues,
	};
	try {
		const request = await fetch(
			"https://api.pinata.cloud/pinning/hashMetadata",
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${config?.pinataJwt}`,
				},
				body: JSON.stringify(data),
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

		const res: string = await request.text();
		return res;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(
				`Error processing updateMetadata: ${error.message}`,
			);
		}
		throw new PinataError("An unknown error occurred while updating metadata");
	}
};
