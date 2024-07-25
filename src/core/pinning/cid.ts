/**
 * Uploads multiple file types
 * @returns message
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
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${jwt}`,
			},
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
