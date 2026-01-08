import type { PinataConfig, CidListQuery, CidListResponse } from "../../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const listCids = async (
	config: PinataConfig | undefined,
	paymentInstructionId: string,
	options?: CidListQuery,
): Promise<CidListResponse> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	if (!paymentInstructionId) {
		throw new ValidationError("Payment instruction ID is required");
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
			Source: "sdk/listCids",
		};
	}

	const params = new URLSearchParams();

	if (options) {
		const { pageToken, limit } = options;

		if (pageToken) params.append("pageToken", pageToken);
		if (limit !== undefined) params.append("limit", limit.toString());
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(
			`${endpoint}/x402/payment_instructions/${paymentInstructionId}/cids?${params.toString()}`,
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
		return res;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing listCids: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while listing CIDs");
	}
};
