/**
 * Uploads JSON data to IPFS via Pinata.
 *
 * This function allows you to upload JSON data directly to IPFS and pin it to Pinata.
 * It's useful for adding structured data, configurations, or any JSON-serializable content
 * to your Pinata account and IPFS network.
 *
 * @async
 * @function uploadJson
 * @template T
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {T} jsonData - The JSON data to be uploaded. Must be a valid JavaScript object that can be JSON-stringified.
 * @param {UploadOptions} [options] - Optional parameters for the upload.
 * @param {PinataMetadata} [options.metadata] - Metadata for the uploaded JSON.
 * @param {string} [options.metadata.name] - Custom name for the JSON content (defaults to "json" if not provided).
 * @param {Record<string, string | number>} [options.metadata.keyValues] - Custom key-value pairs for the JSON metadata.
 * @param {string} [options.keys] - Custom JWT to use for this specific upload.
 * @param {string} [options.groupId] - ID of the group to add the uploaded JSON to.
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
 * const upload = await pinata.upload.json({
 *   name: "Pinnie NFT",
 *   description: "A Pinnie NFT from Pinata",
 *   image: "ipfs://bafkreih5aznjvttude6c3wbvqeebb6rlx5wkbzyppv7garjiubll2ceym4"
 * })
 */

import type {
	PinataConfig,
	UploadResponse,
	UploadOptions,
	JsonBody,
} from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const uploadJson = async <T extends JsonBody>(
	config: PinataConfig | undefined,
	jsonData: T,
	options?: UploadOptions,
) => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	const jwt: string | undefined = options?.keys || config?.pinataJwt;

	const json = JSON.stringify(jsonData);
	const blob = new Blob([json]);
	const file = new File([blob], "data.json", { type: "application/json" });

	const data = new FormData();
	data.append("file", file, file.name);
	data.append("name", options?.metadata?.name || file.name || "File from SDK");
	if (options?.groupId) {
		data.append("group_id", options.groupId);
	}
	if (options?.metadata?.keyvalues) {
		data.append("keyvalues", JSON.stringify(options.metadata.keyvalues));
	}

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = {
			Authorization: `Bearer ${jwt}`,
			...config.customHeaders,
		};
	} else {
		headers = {
			Authorization: `Bearer ${jwt}`,
			Source: "sdk/json",
		};
	}

	let endpoint: string = "https://uploads.pinata.cloud/v3";

	if (config.uploadUrl) {
		endpoint = config.uploadUrl;
	}

	if (options?.url) {
		try {
			const request = await fetch(options.url, {
				method: "POST",
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
				throw new PinataError(`Error processing base64: ${error.message}`);
			}
			throw new PinataError(
				"An unknown error occurred while trying to upload base64",
			);
		}
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
		if (options?.vectorize) {
			const vectorReq = await fetch(
				`${endpoint}/vectorize/files/${resData.id}`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${jwt}`,
					},
				},
			);
			if (vectorReq.ok) {
				resData.vectorized = true;
				return resData;
			} else {
				const errorData = await vectorReq.text();
				throw new NetworkError(
					`HTTP error during vectorization: ${errorData}`,
					vectorReq.status,
					errorData,
				);
			}
		}
		return resData;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing json: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while uploading json");
	}
};
