import type {
	PinataConfig,
	CidAssociationResponse,
} from "../../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const addCid = async (
	config: PinataConfig | undefined,
	paymentInstructionId: string,
	cid: string,
): Promise<CidAssociationResponse> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	if (!paymentInstructionId) {
		throw new ValidationError("Payment instruction ID is required");
	}

	if (!cid) {
		throw new ValidationError("CID is required");
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
			Source: "sdk/addCid",
		};
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(
			`${endpoint}/x402/payment_instructions/${paymentInstructionId}/cids/${cid}`,
			{
				method: "PUT",
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
			throw new PinataError(`Error processing addCid: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while adding CID");
	}
};