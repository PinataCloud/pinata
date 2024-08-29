/**
 * Uploads multiple files to IPFS via Pinata as a single directory.
 *
 * This function allows you to upload multiple files to IPFS and pin them to Pinata
 * as a single directory. It's useful for adding collections of related files or
 * entire directories to your Pinata account and IPFS network.
 *
 * @async
 * @function uploadFileArray
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {File[]} files - An array of File objects to be uploaded.
 * @param {UploadOptions} [options] - Optional parameters for the upload.
 * @param {PinataMetadata} [options.metadata] - Metadata for the uploaded directory.
 * @param {string} [options.metadata.name] - Name for the directory (defaults to "folder_from_sdk" if not provided).
 * @param {Record<string, string | number>} [options.metadata.keyValues] - Custom key-value pairs for the directory metadata.
 * @param {string} [options.keys] - Custom JWT to use for this specific upload.
 * @param {string} [options.groupId] - ID of the group to add the uploaded directory to.
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
 * const file1 = new File(["hello world!"], "hello.txt", { type: "text/plain" })
 * const file2 = new File(["hello world again!"], "hello2.txt", { type: "text/plain" })
 * const upload = await pinata.upload.fileArray([file1, file2])
 */

import type { PinataConfig, UploadResponse, UploadOptions } from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const uploadFileArray = async (
	config: PinataConfig | undefined,
	files: File[],
	options?: UploadOptions,
) => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	const jwt: string | undefined = options?.keys || config?.pinataJwt;

	const folder = options?.metadata?.name || "folder_from_sdk";
	const data = new FormData();

	for (const file of Array.from(files)) {
		data.append("file", file, `${folder}/${file.name}`);
	}
	data.append("name", folder);
	if (options?.groupId) {
		data.append("group_id", options.groupId);
	}

	// data.append(
	// 	"pinataMetadata",
	// 	JSON.stringify({
	// 		name: folder,
	// 		keyvalues: options?.metadata?.keyValues,
	// 	}),
	// );

	// data.append(
	// 	"pinataOptions",
	// 	JSON.stringify({
	// 		cidVersion: options?.cidVersion,
	// 		groupId: options?.groupId,
	// 	}),
	// );

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = { ...config.customHeaders };
	} else {
		headers = {
			Authorization: `Bearer ${jwt}`,
			Source: "sdk/fileArray",
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
			throw new PinataError(`Error processing fileArray: ${error.message}`);
		}
		throw new PinataError(
			"An unknown error occurred while uploading an array of files",
		);
	}
};
