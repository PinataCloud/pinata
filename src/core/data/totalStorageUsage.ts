/**
 * Retrieves the total storage usage in bytes for all files pinned to Pinata by the authenticated user.
 *
 * This function makes a request to the Pinata API to fetch the total storage size
 * of all files that the user has pinned to their account. This can be useful for
 * monitoring account usage, managing storage limits, and planning for capacity.
 *
 * @async
 * @function totalStorageUsage
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @returns {Promise<number>} A promise that resolves to the total storage usage in bytes.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the retrieval process.
 *
 * @example
 * const config = { pinataJwt: 'your-jwt-token' };
 * try {
 *   const totalBytes = await totalStorageUsage(config);
 *   console.log(`Total storage usage: ${totalBytes} bytes`);
 *   console.log(`Total storage usage: ${totalBytes / (1024 * 1024)} MB`);
 * } catch (error) {
 *   console.error('Error getting total storage usage:', error);
 * }
 */

import type { PinataConfig, UserPinnedDataResponse } from "../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const totalStorageUsage = async (
	config: PinataConfig | undefined,
): Promise<number> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	let endpoint: string = "https://api.pinata.cloud";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = { ...config.customHeaders };
	} else {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			Source: "sdk/totalStorageUsage",
		};
	}

	try {
		const request = await fetch(`${endpoint}/data/userPinnedDataTotal`, {
			method: "GET",
			headers: headers,
		});
		if (!request.ok) {
			const errorData = await request.text();
			if (request.status === (401 | 403)) {
				throw new AuthenticationError(
					`Authentication failed: ${errorData}`,
					request.status,
					errorData,
				);
			}
			throw new NetworkError(
				`HTTP error: ${errorData}`,
				request.status,
				errorData,
			);
		}
		const res: UserPinnedDataResponse = await request.json();
		return res.pin_size_total;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(
				`Error processing totalStorageUsage: ${error.message}`,
			);
		}
		throw new PinataError(
			"An unknown error occurred while getting total storage usage",
		);
	}
};
