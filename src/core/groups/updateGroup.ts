/**
 * Updates the information of a specified group in Pinata.
 *
 * This function allows you to modify the name of an existing group in your Pinata account.
 * It's useful for renaming groups to better organize your pinned content.
 *
 * @async
 * @function updateGroup
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {UpdateGroupOptions} options - The options for updating a group.
 * @param {string} options.groupId - The ID of the group to be updated.
 * @param {string} options.name - The new name for the group.
 * @returns {Promise<GroupResponseItem>} A promise that resolves to an object containing the updated group's details.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the group update process.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const groups = await pinata.groups.update({
 *	groupId: "3778c10d-452e-4def-8299-ee6bc548bdb0",
 *	name: "My New Group 2"
 * });
 */

import type {
	PinataConfig,
	GroupResponseItem,
	UpdateGroupOptions,
} from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const updateGroup = async (
	config: PinataConfig | undefined,
	options: UpdateGroupOptions,
): Promise<GroupResponseItem> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	const data = JSON.stringify({
		name: options.name,
		is_public: options.isPublic,
	});

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = { ...config.customHeaders };
	} else {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			"Content-Type": "application/json",
			Source: "sdk/updateGroup",
		};
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(`${endpoint}/files/groups/${options.groupId}`, {
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

		const res = await request.json();
		const resData: GroupResponseItem = res.data;
		return resData;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing updateGroup: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while updating group");
	}
};
