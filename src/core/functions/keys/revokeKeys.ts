import type { PinataConfig, RevokeKeyResponse } from "../../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

const wait = (milliseconds: number): Promise<void> => {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
};

export const revokeKeys = async (
	config: PinataConfig | undefined,
	keys: string[],
): Promise<RevokeKeyResponse[]> => {
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
		headers = { ...config.customHeaders };
	} else {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			"Content-Type": "application/json",
			Source: "sdk/revokeKeys",
		};
	}

	const responses: RevokeKeyResponse[] = [];

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	for (const key of keys) {
		try {
			const request = await fetch(`${endpoint}/pinata/keys/${key}`, {
				method: "PUT",
				headers: headers,
			});

			await wait(300);

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
