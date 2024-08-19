/**
 * Retrieves the swap history for a specific CID (Content Identifier) in Pinata.
 *
 * This function allows you to fetch the history of CID swaps for a given CID and domain.
 * It's useful for tracking changes and updates to content over time.
 *
 * @async
 * @function swapHistory
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {SwapHistoryOptions} options - The options for retrieving swap history.
 * @param {string} options.cid - The CID for which to retrieve swap history.
 * @param {string} options.domain - The gateway domain that has the hot swaps plugin installed.
 * @returns {Promise<SwapCidResponse[]>} A promise that resolves to an array of objects, each containing details of a CID swap operation.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {PinataError} If the CID does not have any swap history.
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the retrieval process.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const swapHistory = await pinata.gateways.swapHistory({
 *   cid: "QmSomeCid123",
 *   domain: "example.mypinata.cloud"
 * });
 */

import type {
	SwapCidResponse,
	PinataConfig,
	SwapHistoryOptions,
} from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const swapHistory = async (
	config: PinataConfig | undefined,
	options: SwapHistoryOptions,
): Promise<SwapCidResponse[]> => {
	if (!config || !config.pinataJwt) {
		throw new ValidationError("Pinata configuration or JWT is missing");
	}

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = { ...config.customHeaders };
	} else {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			"Content-Type": "application/json",
			Source: "sdk/swapHistory",
		};
	}

	let endpoint: string = "https://api.pinata.cloud";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(
			`${endpoint}/v3/ipfs/swap/${options.cid}?domain=${options.domain}`,
			{
				method: "GET",
				headers: headers,
			},
		);

		if (!request.ok) {
			const errorData = await request.json();
			if (request.status === 401) {
				throw new AuthenticationError(
					"Authentication failed",
					request.status,
					errorData,
				);
			}
			if (request.status === 404) {
				throw new PinataError(
					"CID does not have history",
					request.status,
					errorData,
				);
			}
			throw new NetworkError(
				`HTTP error! status: ${request.status}`,
				request.status,
				errorData,
			);
		}

		const res = await request.json();
		const resData: SwapCidResponse[] = res.data;
		return resData;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error fetching swap history: ${error.message}`);
		}
		throw new PinataError(
			"An unknown error occurred while fetching swap history",
		);
	}
};
