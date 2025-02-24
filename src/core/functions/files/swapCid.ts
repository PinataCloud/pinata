import type {
	SwapCidOptions,
	SwapCidResponse,
	PinataConfig,
} from "../../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const swapCid = async (
	config: PinataConfig | undefined,
	options: SwapCidOptions,
	network: "public" | "private",
): Promise<SwapCidResponse> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	const data = JSON.stringify({
		swap_cid: options.swapCid,
	});

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
			Source: "sdk/swapCid",
		};
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(
			`${endpoint}/files/${network}/swap/${options.cid}`,
			{
				method: "PUT",
				headers: headers,
				body: data,
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
			if (request.status === 403) {
				throw new PinataError("Unauthorized CID Swap", request.status, {
					error: errorData,
					code: "AUTH_ERROR",
					metadata: {
						requestUrl: request.url,
					},
				});
			}
			if (request.status === 404) {
				throw new PinataError("CID not pinned to account", request.status, {
					error: errorData,
					code: "HTTP_ERROR",
					metadata: {
						requestUrl: request.url,
					},
				});
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
		const resData: SwapCidResponse = res.data;
		return resData;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing CID Swap: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while swapping CID");
	}
};
