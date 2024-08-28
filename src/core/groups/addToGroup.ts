/**
 * Adds one or more CIDs (Content Identifiers) to a specified Pinata group.
 *
 * This function allows you to associate multiple CIDs with a group in Pinata,
 * which can be useful for organizing and managing your pinned content.
 *
 * @async
 * @function addToGroup
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {GroupCIDOptions} options - The options for adding CIDs to a group.
 * @param {string} options.groupId - The ID of the group to add the CIDs to.
 * @param {string[]} options.cids - An array of CIDs to add to the group.
 * @returns {Promise<string>} A promise that resolves to a string confirming the addition.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the process.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const group = await pinata.groups.addCids({
 * 	groupId: "3778c10d-452e-4def-8299-ee6bc548bdb0",
 * 	cids: ["QmVLwvmGehsrNEvhcCnnsw5RQNseohgEkFNN1848zNzdng"],
 * });
 */
import type { GroupCIDOptions, PinataConfig } from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const addToGroup = async (
	config: PinataConfig | undefined,
	options: GroupCIDOptions,
): Promise<string> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	const data = JSON.stringify({
		cids: options.cids,
	});

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = { ...config.customHeaders };
	} else {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			"Content-Type": "application/json",
			Source: "sdk/addToGroup",
		};
	}

	let endpoint: string = "https://api.devpinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(`${endpoint}/groups/${options.groupId}/cids`, {
			method: "PUT",
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

		const res: string = await request.text();
		return res;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing addToGroup: ${error.message}`);
		}
		throw new PinataError(
			"An unknown error occurred while adding CIDs to group",
		);
	}
};
