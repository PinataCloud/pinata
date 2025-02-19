import type {
	KeyListItem,
	KeyListQuery,
	KeyListResponse,
	PinataConfig,
} from "../../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const listKeys = async (
	config: PinataConfig | undefined,
	options?: KeyListQuery,
): Promise<KeyListItem[]> => {
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
	} else {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			"Content-Type": "application/json",
			Source: "sdk/listKeys",
		};
	}

	const params = new URLSearchParams();

	if (options) {
		const { offset, name, revoked, limitedUse, exhausted } = options;

		if (offset) params.append("offset", offset.toString());
		if (revoked !== undefined) params.append("revoked", revoked.toString());
		if (limitedUse !== undefined)
			params.append("limitedUse", limitedUse.toString());
		if (exhausted !== undefined)
			params.append("exhausted", exhausted.toString());
		if (name) params.append("name", name);
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(
			`${endpoint}/pinata/keys?${params.toString()}`,
			{
				method: "GET",
				headers: headers,
			},
		);

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

		const res: KeyListResponse = await request.json();
		return res.keys;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing listKeys: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while listing API keys");
	}
};
