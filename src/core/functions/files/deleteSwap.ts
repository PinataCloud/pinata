import type { SwapCidResponse, PinataConfig } from "../../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const deleteSwap = async (
	config: PinataConfig | undefined,
	cid: string,
	network: "public" | "private",
): Promise<string> => {
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
			Source: "sdk/deleteSwap",
		};
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(`${endpoint}/files/${network}/swap/${cid}`, {
			method: "DELETE",
			headers: headers,
		});

		if (!request.ok) {
			const errorData = await request.text();
			if (request.status === 401 || request.status === 403) {
				throw new AuthenticationError(`Authentication failed`, request.status, {
					error: errorData,
					code: "AUTH_ERROR",
				});
			}
			if (request.status === 403) {
				throw new PinataError(
					"Unauthorized CID Swap Deletion",
					request.status,
					{
						error: errorData,
						code: "UNAUTHORIZED",
					},
				);
			}
			if (request.status === 404) {
				throw new PinataError("CID not pinned to account", request.status, {
					error: errorData,
					code: "NOT_FOUND",
				});
			}
			throw new NetworkError(`HTTP error occurred`, request.status, {
				error: errorData,
				code: "NETWORK_ERROR",
			});
		}

		return request.statusText;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(
				`Error processing deleteSwap: ${error.message}`,
				undefined,
				{
					code: "DELETE_SWAP_ERROR",
				},
			);
		}
		throw new PinataError(
			"An unknown error occurred while deleting swap",
			undefined,
			{
				code: "UNKNOWN_ERROR",
			},
		);
	}
};
