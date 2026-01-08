import type {
	PinataConfig,
	UpdatePaymentInstructionRequest,
	PaymentInstructionResponse,
} from "../../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const updatePaymentInstruction = async (
	config: PinataConfig | undefined,
	id: string,
	request: UpdatePaymentInstructionRequest,
): Promise<PaymentInstructionResponse> => {
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
			Source: "sdk/updatePaymentInstruction",
		};
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const requestObj = await fetch(
			`${endpoint}/x402/payment_instructions/${id}`,
			{
				method: "PATCH",
				headers: headers,
				body: JSON.stringify(request),
			},
		);

		if (!requestObj.ok) {
			const errorData = await requestObj.text();
			if (requestObj.status === 401 || requestObj.status === 403) {
				throw new AuthenticationError(
					`Authentication failed: ${errorData}`,
					requestObj.status,
					{
						error: errorData,
						code: "AUTH_ERROR",
						metadata: {
							requestUrl: requestObj.url,
						},
					},
				);
			}
			throw new NetworkError(`HTTP error: ${errorData}`, requestObj.status, {
				error: errorData,
				code: "HTTP_ERROR",
				metadata: {
					requestUrl: requestObj.url,
				},
			});
		}

		const res = await requestObj.json();
		return res;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing updatePaymentInstruction: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while updating payment instruction");
	}
};