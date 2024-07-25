/**
 * Revokes multiple API keys
 * @returns Array of responses for each key revocation attempt
 */

import type { PinataConfig, RevokeKeyResponse } from "../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

const wait = (milliseconds: number): Promise<void> => {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
};

export const revokeKeys = async (
	config: PinataConfig | undefined,
	keys: string[],
): Promise<RevokeKeyResponse[]> => {
	if (!config || !config.pinataJwt) {
		throw new ValidationError("Pinata configuration or JWT is missing");
	}

	const responses: RevokeKeyResponse[] = [];

	for (const key of keys) {
		try {
			const request = await fetch(
				`https://api.pinata.cloud/v3/pinata/keys/${key}`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${config.pinataJwt}`,
					},
				},
			);

			await wait(300);

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

			const result: string = await request.json();
			responses.push({
				key: key,
				status: result,
			});
		} catch (error) {
			let errorMessage: string;

			if (error instanceof PinataError) {
				errorMessage = error.message;
			} else if (error instanceof Error) {
				errorMessage = `Error revoking key ${key}: ${error.message}`;
			} else {
				errorMessage = `An unknown error occurred while revoking key ${key}`;
			}

			responses.push({
				key: key,
				status: errorMessage,
			});
		}
	}

	return responses;
};
