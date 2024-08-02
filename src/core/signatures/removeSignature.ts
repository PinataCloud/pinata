/**
 * Removes the signature associated with a specific Content Identifier (CID) from Pinata.
 *
 * This function allows you to delete the cryptographic signature associated with a file
 * identified by its CID. It's useful for managing ownership claims or updating the
 * authenticity status of content stored on IPFS via Pinata.
 *
 * @async
 * @function removeSignature
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {string} cid - The Content Identifier (CID) of the file whose signature is to be removed.
 * @returns {Promise<string>} A promise that resolves to "OK" if the signature was successfully removed.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the signature removal process.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const signature = await pinata.signatures.delete("QmXGeVy9dVwfuFJmvbzz8y4dYK1TdxXbDGzwbNuyZ5xXSU"
 )
 */

import type { PinataConfig } from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const removeSignature = async (
	config: PinataConfig | undefined,
	cid: string,
): Promise<string> => {
	if (!config || !config.pinataJwt) {
		throw new ValidationError("Pinata configuration or JWT is missing");
	}

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		Authorization: `Bearer ${config?.pinataJwt}`,
	};

	if (config.customHeaders) {
		Object.assign(headers, config.customHeaders);
	}

	// biome-ignore lint/complexity/useLiteralKeys: non-issue
	headers["Source"] = headers["Source"] || "sdk/removeSignature";

	try {
		const request = await fetch(
			`https://api.pinata.cloud/v3/ipfs/signature/${cid}`,
			{
				method: "DELETE",
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
			throw new NetworkError(
				`HTTP error! status: ${request.status}`,
				request.status,
				errorData,
			);
		}
		return "OK";
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing addSignature: ${error.message}`);
		}
		throw new PinataError(
			"An unknown error occurred while adding signature to CID",
		);
	}
};
