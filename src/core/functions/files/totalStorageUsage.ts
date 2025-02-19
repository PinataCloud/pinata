import type { PinataConfig, UserPinnedDataResponse } from "../../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const totalStorageUsage = async (
	config: PinataConfig | undefined,
): Promise<number> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	let endpoint: string = "https://api.pinata.cloud";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = { ...config.customHeaders };
	} else {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			Source: "sdk/totalStorageUsage",
		};
	}

	try {
		const request = await fetch(`${endpoint}/data/userPinnedDataTotal`, {
			method: "GET",
			headers: headers,
		});
		if (!request.ok) {
			const errorData = await request.text();
			if (request.status === 401 || request.status === 403) {
				throw new AuthenticationError(
					`Authentication failed: ${errorData}`,
					request.status,
					{
						error: errorData,
						code: "AUTH_ERROR",
						metadata: {
							requestUrl: request.url,
						},
					},
				);
			}
			throw new NetworkError(`HTTP error: ${errorData}`, request.status, {
				error: errorData,
				code: "HTTP_ERROR",
				metadata: {
					requestUrl: request.url,
				},
			});
		}
		const res: UserPinnedDataResponse = await request.json();
		return res.pin_size_total;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(
				`Error processing totalStorageUsage: ${error.message}`,
			);
		}
		throw new PinataError(
			"An unknown error occurred while getting total storage usage",
		);
	}
};
