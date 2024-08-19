/**
 * Retrieves the content of a file from IPFS using its Content Identifier (CID).
 *
 * This function fetches the content associated with a given CID from the specified
 * Pinata gateway. It can handle various content types and returns the data along
 * with the content type information.
 *
 * @async
 * @function getCid
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT and gateway information.
 * @param {string} cid - The Content Identifier (CID) of the file to retrieve.
 * @returns {Promise<GetCIDResponse>} A promise that resolves to an object containing the file data and content type.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the retrieval process.
 *
 * @example
 *  import { PinataSDK } from "pinata";
 *
 *  const pinata = new PinataSDK({
 *    pinataJwt: process.env.PINATA_JWT!,
 *    pinataGateway: "example-gateway.mypinata.cloud",
 *  });
 *
 *  const upload = await pinata.gateways.get("QmVLwvmGehsrNEvhcCnnsw5RQNseohgEkFNN1848zNzdng"* )
 *
 */

import { convertToDesiredGateway } from "../../utils/gateway-tools";
import type { GetCIDResponse, PinataConfig } from "../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const getCid = async (
	config: PinataConfig | undefined,
	cid: string,
): Promise<GetCIDResponse> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	let data: JSON | string | Blob;
	let newUrl: string;

	newUrl = await convertToDesiredGateway(cid, config?.pinataGateway);

	if (config?.pinataGatewayKey) {
		newUrl = `${newUrl}?pinataGatewayToken=${config?.pinataGatewayKey}`;
	}

	try {
		const request = await fetch(newUrl);

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

		const contentType: string | null = request.headers.get("content-type");

		if (contentType?.includes("application/json")) {
			data = await request.json();
		} else if (contentType?.includes("text/")) {
			data = await request.text();
		} else {
			data = await request.blob();
		}

		const res: GetCIDResponse = {
			data: data,
			contentType: contentType,
		};

		return res;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing getCid: ${error.message}`);
		}
		throw new PinataError(
			"An unknown error occurred while getting CID contents",
		);
	}
};
