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

import type {
	GetCIDResponse,
	PinataConfig,
	OptimizeImageOptions,
} from "../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const getCid = async (
	config: PinataConfig | undefined,
	cid: string,
	// options?: OptimizeImageOptions,
): Promise<GetCIDResponse> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	let data: JSON | string | Blob;
	let newUrl: string = `${config?.pinataGateway}/files/${cid}`;

	const params = new URLSearchParams();

	const date = Math.floor(new Date().getTime() / 1000);

	const payload = JSON.stringify({
		url: newUrl,
		date: date,
		expires: 30,
		method: "GET",
	});

	const signedUrlRequest = await fetch(
		"https://api.pinata.cloud/v3/files/sign",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${config?.pinataJwt}`,
			},
			body: payload,
		},
	);

	const signedUrl = await signedUrlRequest.json();

	// if (config?.pinataGatewayKey) {
	// 	params.append("pinataGatewayToken", config.pinataGatewayKey);
	// }

	// if (options) {
	// 	if (options.width) params.append("img-width", options.width.toString());
	// 	if (options.height) params.append("img-height", options.height.toString());
	// 	if (options.dpr) params.append("img-dpr", options.dpr.toString());
	// 	if (options.fit) params.append("img-fit", options.fit);
	// 	if (options.gravity) params.append("img-gravity", options.gravity);
	// 	if (options.quality)
	// 		params.append("img-quality", options.quality.toString());
	// 	if (options.format) params.append("img-format", options.format);
	// 	if (options.animation !== undefined)
	// 		params.append("img-anim", options.animation.toString());
	// 	if (options.sharpen)
	// 		params.append("img-sharpen", options.sharpen.toString());
	// 	if (options.onError === true) params.append("img-onerror", "redirect");
	// 	if (options.metadata) params.append("img-metadata", options.metadata);
	// }

	// const queryString = params.toString();
	// if (queryString) {
	// 	newUrl += `?${queryString}`;
	// }

	try {
		const request = await fetch(signedUrl.data);

		if (!request.ok) {
			const errorData = await request.text();
			if (request.status === 401 || request.status === 403) {
				throw new AuthenticationError(
					`Authentication Failed: ${errorData}`,
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
