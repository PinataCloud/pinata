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
	GroupListResponse,
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
): Promise<GroupListResponse> => {
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
			Source: "sdk/listGroups",
		};
	}

	const params = new URLSearchParams();

	if (options) {
		const { pageToken, name, limit, isPublic } = options;

		if (pageToken) params.append("pageToken", pageToken.toString());
		if (isPublic) params.append("isPublic", isPublic.toString());
		if (name) params.append("name", name);
		if (limit !== undefined) params.append("limit", limit.toString());
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(
			`${endpoint}/files/groups?${params.toString()}`,
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

		const res = await request.json();
		const resData: GroupListResponse = res.data;
		return resData;
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
