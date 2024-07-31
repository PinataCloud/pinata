/**
 * Updates the metadata for a pinned file on Pinata.
 *
 * This function allows you to modify the name and/or key-value pairs associated
 * with a file that has already been pinned to Pinata. This is useful for
 * organizing and categorizing your pinned content.
 *
 * @async
 * @function updateMetadata
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {PinataMetadataUpdate} options - The options for updating the metadata.
 * @param {string} options.cid - The Content Identifier (CID) of the pinned file to update.
 * @param {string} [options.name] - The new name to assign to the pinned file (optional).
 * @param {Record<string, string | number>} [options.keyValues] - Key-value pairs to associate with the pinned file (optional).
 * @returns {Promise<string>} A promise that resolves to a string confirming the update.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the metadata update process.
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const update = await pinata.updateMedatadata({
 *   cid: "bafkreih5aznjvttude6c3wbvqeebb6rlx5wkbzyppv7garjiubll2ceym4",
 *   name: "Pinnie V2",
 *   keyValues: {
 *     whimsey: 200
 *   }
 * })
 */

import type { PinataConfig, PinataMetadataUpdate } from "../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const updateMetadata = async (
	config: PinataConfig | undefined,
	options: PinataMetadataUpdate,
): Promise<string> => {
	if (!config || !config.pinataJwt) {
		throw new ValidationError("Pinata configuration or JWT is missing");
	}
	const data = {
		ipfsPinHash: options.cid,
		name: options.name,
		keyvalues: options.keyValues,
	};
	try {
		const request = await fetch(
			"https://api.pinata.cloud/pinning/hashMetadata",
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${config?.pinataJwt}`,
				},
				body: JSON.stringify(data),
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

		const res: string = await request.text();
		return res;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(
				`Error processing updateMetadata: ${error.message}`,
			);
		}
		throw new PinataError("An unknown error occurred while updating metadata");
	}
};
