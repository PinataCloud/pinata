import type {
	PinataConfig,
	PaymentInstructionListQuery,
	PaymentInstructionListResponse,
} from "../../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const listPaymentInstructions = async (
	config: PinataConfig | undefined,
	options?: PaymentInstructionListQuery,
): Promise<PaymentInstructionListResponse> => {
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
			Source: "sdk/listPaymentInstructions",
		};
	}

	const params = new URLSearchParams();

	if (options) {
		const { pageToken, limit, cid, name, id } = options;

		if (pageToken) params.append("pageToken", pageToken);
		if (limit !== undefined) params.append("limit", limit.toString());
		if (cid) params.append("cid", cid);
		if (name) params.append("name", name);
		if (id) params.append("id", id);
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(
			`${endpoint}/x402/payment_instructions?${params.toString()}`,
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
			throw new PinataError(`Error processing listPaymentInstructions: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while listing payment instructions");
	}
};