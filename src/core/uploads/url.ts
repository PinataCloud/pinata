/**
 * Uploads content from a URL to IPFS via Pinata.
 *
 * This function allows you to upload content from a specified URL to IPFS and pin it to Pinata.
 * It's useful for adding remote content to your Pinata account and IPFS network without
 * first downloading it locally.
 *
 * @async
 * @function uploadUrl
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {string} url - The URL of the content to be uploaded.
 * @param {UploadOptions} [options] - Optional parameters for the upload.
 * @param {PinataMetadata} [options.metadata] - Metadata for the uploaded content.
 * @param {string} [options.metadata.name] - Custom name for the content (defaults to "url_upload" if not provided).
 * @param {Record<string, string | number>} [options.metadata.keyValues] - Custom key-value pairs for the content metadata.
 * @param {string} [options.keys] - Custom JWT to use for this specific upload.
 * @param {string} [options.groupId] - ID of the group to add the uploaded content to.
 * @param {0 | 1} [options.cidVersion] - Version of CID to use (0 or 1).
 * @returns {Promise<PinResponse>} A promise that resolves to an object containing the IPFS hash and other upload details.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request or URL fetch.
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
 * const upload = await pinata.upload.url("https://i.imgur.com/u4mGk5b.gif")
 */

import type { PinataConfig, UploadResponse, UploadOptions } from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const uploadUrl = async (
	config: PinataConfig | undefined,
	url: string,
	options?: UploadOptions,
) => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	const jwt: string | undefined = options?.keys || config?.pinataJwt;
	const data = new FormData();

	const stream = await fetch(url);

	if (!stream.ok) {
		const errorData = await stream.text();
		throw new NetworkError(
			`HTTP error: ${errorData}`,
			stream.status,
			errorData,
		);
	}

	const arrayBuffer = await stream.arrayBuffer();

	const blob = new Blob([arrayBuffer]);

	const name = options?.metadata?.name ?? "url_upload";

	const file = new File([blob], name);

	data.append("file", file, name);
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
		headers = {
			Authorization: `Bearer ${jwt}`,
			...config.customHeaders,
		};
	} else {
		headers = {
			Authorization: `Bearer ${jwt}`,
			Source: "sdk/url",
		};
	}

	let endpoint: string = "https://uploads.pinata.cloud/v3";

	if (config.uploadUrl) {
		endpoint = config.uploadUrl;
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

		const res = await request.json();
		const resData: UploadResponse = res.data;
		return resData;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing url: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while uploading by url");
	}
};
