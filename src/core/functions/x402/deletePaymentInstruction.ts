import type {
	PinataConfig,
	PaymentInstructionDeleteResponse,
} from "../../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const deletePaymentInstruction = async (
	config: PinataConfig | undefined,
	id: string,
): Promise<PaymentInstructionDeleteResponse> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	if (!id) {
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
			Source: "sdk/deletePaymentInstruction",
		};
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(`${endpoint}/x402/payment_instructions/${id}`, {
			method: "DELETE",
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

		const res = await request.json();
		return res;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(
				`Error processing deletePaymentInstruction: ${error.message}`,
			);
		}
		throw new PinataError(
			"An unknown error occurred while deleting payment instruction",
		);
	}
};
