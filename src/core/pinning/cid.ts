/**
 * Pins an existing file on IPFS to Pinata using its Content Identifier (CID).
 *
 * This function allows you to add an existing IPFS file to your Pinata account
 * by providing its CID. It's useful for ensuring long-term storage and
 * availability of content that's already on IPFS.
 *
 * @async
 * @function uploadCid
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {string} cid - The Content Identifier (CID) of the IPFS file to pin.
 * @param {UploadCIDOptions} [options] - Optional parameters for the upload.
 * @param {PinataMetadata} [options.metadata] - Metadata for the pinned file.
 * @param {string} [options.metadata.name] - Name for the pinned file (defaults to the CID if not provided).
 * @param {Record<string, string | number>} [options.metadata.keyValues] - Custom key-value pairs for the file metadata.
 * @param {string[]} [options.peerAddresses] - Array of peer addresses to contact for pinning.
 * @param {string} [options.keys] - Custom JWT to use for this specific upload.
 * @param {string} [options.groupId] - ID of the group to add the pinned file to.
 * @returns {Promise<PinByCIDResponse>} A promise that resolves to an object containing details about the pinning job.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the pinning process.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const pin = await pinata.upload.cid("QmVLwvmGehsrNEvhcCnnsw5RQNseohgEkFNN1848zNzdng")
 */

import type {
	PinataConfig,
	PinByCIDResponse,
	UploadCIDOptions,
} from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const uploadCid = async (
	config: PinataConfig | undefined,
	cid: string,
	options?: UploadCIDOptions,
) => {
	if (!config || !config.pinataJwt) {
		throw new ValidationError("Pinata configuration or JWT is missing");
	}

	const jwt: string = options?.keys || config?.pinataJwt;

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = { ...config.customHeaders };
	} else {
		headers = {
			Authorization: `Bearer ${jwt}`,
			"Content-Type": "application/json",
			Source: "sdk/cid",
		};
	}

	const data = JSON.stringify({
		hashToPin: cid,
		pinataMetadata: {
			name: options?.metadata ? options?.metadata?.name : cid,
			keyvalues: options?.metadata?.keyValues,
		},
		pinataOptions: {
			hostNodes: options?.peerAddresses ? options.peerAddresses : "",
			groupId: options?.groupId,
		},
	});

	try {
		const request = await fetch("https://api.pinata.cloud/pinning/pinByHash", {
			method: "POST",
			headers: headers,
			body: data,
		});

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

		const res: PinByCIDResponse = await request.json();
		return res;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing cid: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while pinning by CID");
	}
};
