/**
 * Swaps a CID (Content Identifier) with a new one in Pinata.
 *
 * This function allows you to replace an existing CID with a new one in your Pinata account.
 * It's useful for updating content while maintaining the same access point or reference.
 *
 * @async
 * @function swapCid
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {SwapCidOptions} options - The options for swapping the CID.
 * @param {string} options.cid - The original CID to be replaced.
 * @param {string} options.swapCid - The new CID to replace the original one.
 * @returns {Promise<SwapCidResponse>} A promise that resolves to an object containing details of the CID swap operation.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {PinataError} If the swap operation is unauthorized or if the original CID is not found in the account.
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the CID swap process.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const swapResult = await pinata.gateways.swapCid({
 *   cid: "QmOldCid123",
 *   swapCid: "QmNewCid456"
 * });
 */

import type { SwapCidOptions, SwapCidResponse, PinataConfig } from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const swapCid = async (
	config: PinataConfig | undefined,
	options: SwapCidOptions,
): Promise<SwapCidResponse> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	const data = JSON.stringify({
		swapCid: options.swapCid,
	});

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = { ...config.customHeaders };
	} else {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			"Content-Type": "application/json",
			Source: "sdk/swapCid",
		};
	}

	let endpoint: string = "https://api.pinata.cloud";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(`${endpoint}/v3/ipfs/swap/${options.cid}`, {
			method: "PUT",
			headers: headers,
			body: data,
		});

		if (!request.ok) {
			const errorData = await request.text();
			if (request.status === (401 | 403)) {
				throw new AuthenticationError(
					`Authentication failed: ${errorData}`,
					request.status,
					errorData,
				);
			}
			if (request.status === 403) {
				throw new PinataError(
					"Unauthorized CID Swap",
					request.status,
					errorData,
				);
			}
			if (request.status === 404) {
				throw new PinataError(
					"CID not pinned to account",
					request.status,
					errorData,
				);
			}
			throw new NetworkError(
				`HTTP error: ${errorData}`,
				request.status,
				errorData,
			);
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
