import type {
	PinataConfig,
	GroupResponseItem,
	GroupQueryOptions,
	GroupListResponse,
} from "../../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const listGroups = async (
	config: PinataConfig | undefined,
	privacy: "public" | "private",
	options?: GroupQueryOptions,
): Promise<GroupListResponse> => {
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
			Source: "sdk/listGroups",
		};
	}

	const params = new URLSearchParams();

	if (options) {
		const { pageToken, name, limit, isPublic } = options;

		if (pageToken) params.append("pageToken", pageToken.toString());
		if (isPublic) params.append("isPublic", isPublic.toString());
		if (name) params.append("name", name);
		if (limit !== undefined) params.append("limit", limit.toString());
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(
			`${endpoint}/groups/${privacy}?${params.toString()}`,
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

		const res = await request.json();
		const resData: GroupListResponse = res.data;
		return resData;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing listGroups: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while listing groups");
	}
};
