/**
 * Uploads multiple file types
 * @returns message
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
	if (!config || !config.pinataJwt) {
		throw new ValidationError("Pinata configuration or JWT is missing");
	}

	try {
		const request = await fetch(
			`https://api.pinata.cloud/groups/${options.groupId}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${config?.pinataJwt}`,
				},
			},
		);

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

		const res: GroupResponseItem = await request.json();
		return res;
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
