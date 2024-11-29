import type { PinataConfig, VectorizeFileResponse } from "../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const deleteFileVectors = async (
	config: PinataConfig | undefined,
	fileId: string,
): Promise<VectorizeFileResponse> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			...config.customHeaders,
		};
	} else {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			Source: "sdk/vectorizeFile",
		};
	}

	let endpoint: string = "https://uploads.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(`${endpoint}/vectorize/files/${fileId}`, {
			method: "DELETE",
			headers: headers,
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

		const res: VectorizeFileResponse = await request.json();
		return res;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(
				`Error processing vectorize file: ${error.message}`,
			);
		}
		throw new PinataError("An unknown error occurred while vectorizing file");
	}
};
