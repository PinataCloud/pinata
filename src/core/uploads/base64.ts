/**
 * Uploads a base64-encoded string to IPFS via Pinata.
 *
 * This function allows you to upload content to IPFS that is encoded as a base64 string.
 * It's particularly useful for uploading binary data or files that have been converted to base64.
 *
 * @async
 * @function uploadBase64
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {string} base64String - The base64-encoded string to be uploaded.
 * @param {UploadOptions} [options] - Optional parameters for the upload.
 * @param {PinataMetadata} [options.metadata] - Metadata for the uploaded file.
 * @param {string} [options.metadata.name] - Name for the uploaded file (default is "base64 string").
 * @param {Record<string, string | number>} [options.metadata.keyvalues] - Custom key-value pairs for the file metadata.
 * @param {string} [options.keys] - Custom JWT to use for this specific upload.
 * @param {string} [options.groupId] - ID of the group to add the uploaded file to.
 * @param {0 | 1} [options.cidVersion] - Version of CID to use (0 or 1).
 * @returns {Promise<PinResponse>} A promise that resolves to an object containing the IPFS hash and other upload details.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the upload process.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const upload = await pinata.upload.base64("SGVsbG8gV29ybGQh")
 */

import type { PinataConfig, UploadResponse, UploadOptions } from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const uploadBase64 = async (
	config: PinataConfig | undefined,
	base64String: string,
	options?: UploadOptions,
) => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	const jwt: string | undefined = options?.keys || config?.pinataJwt;

	const name = options?.metadata?.name
		? options?.metadata?.name
		: "base64 string";

	const buffer = Buffer.from(base64String, "base64");

	const blob = new Blob([buffer]);

	const data = new FormData();

	data.append("file", blob, name);
	data.append("name", name);
	if (options?.groupId) {
		data.append("group_id", options.groupId);
	}

	// data.append(
	// 	"pinataOptions",
	// 	JSON.stringify({
	// 		cidVersion: options?.cidVersion,
	// 		groupId: options?.groupId,
	// 	}),
	// );

	// data.append(
	// 	"pinataMetadata",
	// 	JSON.stringify({
	// 		name: name,
	// 		keyvalues: options?.metadata?.keyValues,
	// 	}),
	// );

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = { ...config.customHeaders };
	} else {
		headers = {
			Authorization: `Bearer ${jwt}`,
			Source: "sdk/base64",
		};
	}

	let endpoint: string = "https://uploads.devpinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(`${endpoint}/files`, {
			method: "POST",
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

		const res: UploadResponse = await request.json();
		return res;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing base64: ${error.message}`);
		}
		throw new PinataError(
			"An unknown error occurred while trying to upload base64",
		);
	}
};
