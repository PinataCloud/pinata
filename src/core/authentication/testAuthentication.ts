/**
 * Tests the current PinataConfig to ensure the used API key is authenticated
 * @returns message
 */

import type { PinataConfig, AuthTestResponse } from "../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const testAuthentication = async (config: PinataConfig | undefined) => {
	if (!config || !config.pinataJwt) {
		throw new ValidationError("Pinata configuration or JWT is missing");
	}

	try {
		const request = await fetch(
			"https://api.pinata.cloud/data/testAuthentication",
			{
				method: "GET",
				headers: {
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

		const res: AuthTestResponse = await request.json();
		return res;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(
				`Error processing authentication: ${error.message}`,
			);
		}
		throw new PinataError(
			"An unknown error occurred while testing authentication",
		);
	}
};
