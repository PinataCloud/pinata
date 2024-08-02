/**
 * Retrieves the signature associated with a specific Content Identifier (CID) from Pinata.
 *
 * This function allows you to fetch the cryptographic signature associated with a file
 * identified by its CID. It's useful for verifying the authenticity or ownership of
 * content stored on IPFS via Pinata.
 *
 * @async
 * @function getSignature
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {string} cid - The Content Identifier (CID) of the file whose signature is to be retrieved.
 * @returns {Promise<SignatureResponse>} A promise that resolves to an object containing the signature details.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the signature retrieval process.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const signature = await pinata.signatures.get("QmXGeVy9dVwfuFJmvbzz8y4dYK1TdxXbDGzwbNuyZ5xXSU"
 )
 */

import type { PinataConfig, SignatureResponse } from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const getSignature = async (
	config: PinataConfig | undefined,
	cid: string,
): Promise<SignatureResponse> => {
	if (!config || !config.pinataJwt) {
		throw new ValidationError("Pinata configuration or JWT is missing");
	}

	try {
		const request = await fetch(
			`https://api.pinata.cloud/v3/ipfs/signature/${cid}`,
			{
				method: "GET",
				headers: {
					Source: "sdk/getSignature",
					"Content-Type": "application/json",
					Authorization: `Bearer ${config?.pinataJwt}`,
				},
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
			throw new NetworkError(
				`HTTP error! status: ${request.status}`,
				request.status,
				errorData,
			);
		}

		const res = await request.json();
		return res.data;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing getSignature: ${error.message}`);
		}
		throw new PinataError(
			"An unknown error occurred while fetching signature for CID",
		);
	}
};