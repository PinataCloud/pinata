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
 * @param {UpdateFileOptions} options - The options for updating the metadata.
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

import type { FileListItem, PinataConfig, UpdateFileOptions } from "../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const updateFile = async (
	config: PinataConfig | undefined,
	options: UpdateFileOptions,
): Promise<FileListItem> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}
	const data = JSON.stringify({
		name: options.name,
	});

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = { ...config.customHeaders };
	} else {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			"Content-Type": "application/json",
			Source: "sdk/updateMetadata",
		};
	}

	let endpoint: string = "https://api.devpinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(`${endpoint}/files/${options.id}`, {
			method: "PUT",
			headers: headers,
			body: data,
		});

		if (!request.ok) {
			const errorData = await request.text();
			if (request.status === 401 || request.status === 403) {
				throw new AuthenticationError(
					`Authentication failed: ${errorData}`,
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
		const resData: FileListItem = res.data;
		return resData;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing updateFile: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while updating file");
	}
};
