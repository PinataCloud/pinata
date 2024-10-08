/**
 * Creates a new API key for Pinata services.
 *
 * This function allows you to generate a new API key with specific permissions
 * for use with Pinata's IPFS pinning services. It's useful for creating keys
 * with limited access or for specific applications.
 *
 * @async
 * @function createKey
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {KeyOptions} options - The options for creating a new API key.
 * @param {string} options.keyName - The name to assign to the new API key.
 * @param {KeyPermissions} options.permissions - The permissions to assign to the new key.
 * @param {number} [options.maxUses] - Optional. The maximum number of times the key can be used.
 * @returns {Promise<KeyResponse>} A promise that resolves to an object containing the new API key details.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the key creation process.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const key = await pinata.keys.create({
 *   keyName: "user 1",
 *   permissions: {
 *     admin: true,
 *   },
 *   maxUses: 1,
 * });
 */

import type { PinataConfig, KeyOptions, KeyResponse } from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const createKey = async (
	config: PinataConfig | undefined,
	options: KeyOptions,
): Promise<KeyResponse> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			"Content-Type": "application/json",
			...config.customHeaders,
		};
	} else {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			"Content-Type": "application/json",
			Source: "sdk/createKey",
		};
	}

	const data = JSON.stringify(options);

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(`${endpoint}/pinata/keys`, {
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
					errorData,
				);
			}
			throw new NetworkError(
				`HTTP error: ${errorData}`,
				request.status,
				errorData,
			);
		}

		const res: KeyResponse = await request.json();
		return res;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing createKey: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while creating API key");
	}
};
