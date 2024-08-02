/**
 * Retrieves a list of groups from Pinata.
 *
 * This function fetches a list of groups associated with your Pinata account.
 * It supports pagination and filtering by name.
 *
 * @async
 * @function listGroups
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {GroupQueryOptions} [options] - Optional query parameters to filter and paginate the results.
 * @param {number} [options.offset] - The number of items to skip before starting to collect the result set.
 * @param {string} [options.nameContains] - Filter groups by name (case-insensitive partial match).
 * @param {number} [options.limit] - The numbers of items to return.
 * @returns {Promise<GroupResponseItem[]>} A promise that resolves to an array of group objects.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the group listing process.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const groups = await pinata.groups
 *   .list()
 *   .name("Greetings");
 */

import type {
	PinataConfig,
	GroupResponseItem,
	GroupQueryOptions,
} from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const listGroups = async (
	config: PinataConfig | undefined,
	options?: GroupQueryOptions,
): Promise<GroupResponseItem[]> => {
	if (!config || !config.pinataJwt) {
		throw new ValidationError("Pinata configuration or JWT is missing");
	}

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		Authorization: `Bearer ${config?.pinataJwt}`,
	};

	if (config.customHeaders) {
		Object.assign(headers, config.customHeaders);
	}

	// biome-ignore lint/complexity/useLiteralKeys: non-issue
	headers["Source"] = headers["Source"] || "sdk/listGroups";

	const params = new URLSearchParams();

	if (options) {
		const { offset, nameContains, limit } = options;

		if (offset) params.append("offset", offset.toString());
		if (nameContains !== undefined)
			params.append("nameContains", nameContains.toString());
		if (limit !== undefined) params.append("limit", limit.toString());
	}

	const url = `https://api.pinata.cloud/groups?${params.toString()}`;

	try {
		const request = await fetch(url, {
			method: "GET",
			headers: headers,
		});

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

		const res: GroupResponseItem[] = await request.json();
		return res;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing listGroups: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while listing groups");
	}
};
