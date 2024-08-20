/**
 * Deletes a specified group from Pinata.
 *
 * This function allows you to remove a group from your Pinata account.
 * Note that deleting a group does not delete the files within the group,
 * it only removes the group association.
 *
 * @async
 * @function deleteGroup
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {GetGroupOptions} options - The options for deleting a group.
 * @param {string} options.groupId - The ID of the group to be deleted.
 * @returns {Promise<string>} A promise that resolves to a string confirming the deletion.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the group deletion process.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const groups = await pinata.groups.delete({
 *	groupId: "3778c10d-452e-4def-8299-ee6bc548bdb0",
 * });
 */

import type { GetGroupOptions, PinataConfig } from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const deleteGroup = async (
	config: PinataConfig | undefined,
	options: GetGroupOptions,
): Promise<string> => {
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
			Source: "sdk/deleteGroup",
		};
	}

	let endpoint: string = "https://api.pinata.cloud";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(`${endpoint}/groups/${options.groupId}`, {
			method: "DELETE",
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

		const res: string = await request.text();
		return res;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing deleteGroup: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while deleting a group");
	}
};
