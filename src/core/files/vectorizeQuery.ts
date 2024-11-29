import type {
	PinataConfig,
	VectorizeQuery,
	VectorizeQueryResponse,
} from "../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const vectorizeQuery = async (
	config: PinataConfig | undefined,
	options: VectorizeQuery,
): Promise<VectorizeQueryResponse> => {
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
			Source: "sdk/vectorQuery",
		};
	}

	let endpoint: string = "https://uploads.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	const body = JSON.stringify({
		text: options.query,
	});

	try {
		const request = await fetch(
			`${endpoint}/vectorize/groups/${options.groupId}/query`,
			{
				method: "POST",
				headers: headers,
				body: body,
			},
		);

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
		const resData: VectorizeQueryResponse = res.data;
		return resData;
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
