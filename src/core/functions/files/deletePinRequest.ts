import type { PinataConfig } from "../../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const deletePinRequest = async (
	config: PinataConfig | undefined,
	id: string,
): Promise<string> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			...config.customHeaders,
		};
	} else {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			Source: "sdk/deletePinRequest",
		};
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const response = await fetch(`${endpoint}/files/public/pin_by_cid/${id}`, {
			method: "DELETE",
			headers: headers,
		});

		if (!response.ok) {
			const errorData = await response.text();
			if (response.status === 401) {
				throw new AuthenticationError(
					`Authentication failed: ${errorData}`,
					response.status,
					{
						error: errorData,
						code: "HTTP_ERROR",
						metadata: {
							requestUrl: response.url,
						},
					},
				);
			}
			throw new NetworkError(`HTTP error`, response.status, {
				error: errorData,
				code: "HTTP_ERROR",
				metadata: {
					requestUrl: response.url,
				},
			});
		}
		return "OK";
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error deleting pin by request: ${error.message}`);
		}
		throw new PinataError(
			"An unknown error occurred while deleting pin by CID request",
		);
	}
};
