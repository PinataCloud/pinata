/**
 * Retrieves information about a specific group from Pinata.
 *
 * This function fetches details about a group in your Pinata account using its ID.
 * It provides information such as the group's name, creation date, and last update time.
 *
 * @async
 * @function getGroup
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {GetGroupOptions} options - The options for retrieving a group.
 * @param {string} options.groupId - The ID of the group to retrieve.
 * @returns {Promise<GroupResponseItem>} A promise that resolves to an object containing the group's details.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the group retrieval process.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const groups = await pinata.groups.get({
 *	groupId: "3778c10d-452e-4def-8299-ee6bc548bdb0",
 * });
 */

import type {
	PinataConfig,
	GroupResponseItem,
	GetGroupOptions,
} from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const getGroup = async (
	config: PinataConfig | undefined,
	options: GetGroupOptions,
): Promise<GroupResponseItem> => {
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
			Source: "sdk/getGroup",
		};
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(`${endpoint}/files/groups/${options.groupId}`, {
			method: "GET",
			headers: headers,
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

		const res = await request.json();
		const resData: GroupResponseItem = res.data;
		return resData;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing getGroup: ${error.message}`);
		}
		throw new PinataError(
			"An unknown error occurred while getting info for a group",
		);
	}
};
