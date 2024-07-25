/**
 * Description
 * @returns
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
	if (!config || !config.pinataJwt) {
		throw new ValidationError("Pinata configuration or JWT is missing");
	}

	let data: JSON | string | Blob;
	let newUrl: string;

	newUrl = convertToDesiredGateway(cid, config?.pinataGateway);

	if (config?.pinataGatewayKey) {
		newUrl = `${newUrl}?pinataGatewayToken=${config?.pinataGatewayKey}`;
	}

	try {
		const request = await fetch(newUrl, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${config?.pinataJwt}`,
			},
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
