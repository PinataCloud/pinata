/**
 * Creates a new group in Pinata for organizing pinned content.
 *
 * This function allows you to create a new group in your Pinata account.
 * Groups can be used to organize and manage your pinned content more effectively.
 *
 * @async
 * @function createGroup
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {GroupOptions} options - The options for creating a new group.
 * @param {string} options.name - The name of the group to be created.
 * @returns {Promise<GroupResponseItem>} A promise that resolves to an object containing details of the created group.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the group creation process.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const group = await pinata.groups.create({
 *	name: "My New Group",
 * });
 */

import type { PinataConfig, GroupOptions, GroupResponseItem } from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const createGroup = async (
	config: PinataConfig | undefined,
	options: GroupOptions,
): Promise<GroupResponseItem> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	const data = JSON.stringify(options);

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
			Source: "sdk/createGroup",
		};
	}

	let endpoint: string = "https://api.pinata.cloud";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(`${endpoint}/groups`, {
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

		const res: GroupResponseItem = await request.json();
		return res;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing createGroup: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while creating a group");
	}
};
