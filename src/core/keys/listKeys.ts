/**
 * Retrieves a list of API keys associated with the Pinata account.
 *
 * This function allows you to fetch and optionally filter the API keys linked to your Pinata account.
 * It's useful for managing your API keys, checking their status, or auditing key usage.
 *
 * @async
 * @function listKeys
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {KeyListQuery} [options] - Optional query parameters to filter the list of keys.
 * @param {number} [options.offset] - The number of items to skip before starting to collect the result set.
 * @param {boolean} [options.revoked] - If true, includes revoked keys in the results.
 * @param {boolean} [options.limitedUse] - If true, only returns keys with usage limits.
 * @param {boolean} [options.exhausted] - If true, only returns keys that have reached their usage limit.
 * @param {string} [options.name] - Filters keys by name (partial match).
 * @returns {Promise<KeyListItem[]>} A promise that resolves to an array of key objects matching the query.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the key listing process.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const keys = await pinata.keys
 *   .list()
 *   .name("Admin")
 *   .revoked(false)
 */

import type {
	KeyListItem,
	KeyListQuery,
	KeyListResponse,
	PinataConfig,
} from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const listKeys = async (
	config: PinataConfig | undefined,
	options?: KeyListQuery,
): Promise<KeyListItem[]> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = { ...config.customHeaders };
	} else {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			"Content-Type": "application/json",
			Source: "sdk/listKeys",
		};
	}

	const params = new URLSearchParams();

	if (options) {
		const { offset, name, revoked, limitedUse, exhausted } = options;

		if (offset) params.append("offset", offset.toString());
		if (revoked !== undefined) params.append("revoked", revoked.toString());
		if (limitedUse !== undefined)
			params.append("limitedUse", limitedUse.toString());
		if (exhausted !== undefined)
			params.append("exhausted", exhausted.toString());
		if (name) params.append("name", name);
	}

	let endpoint: string = "https://api.devpinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(
			`${endpoint}/pinata/keys?${params.toString()}`,
			{
				method: "GET",
				headers: headers,
			},
		);

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

		const res: KeyListResponse = await request.json();
		return res.keys;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing listKeys: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while listing API keys");
	}
};
