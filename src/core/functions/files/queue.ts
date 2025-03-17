import type {
	PinQueueItem,
	PinQueueQuery,
	PinQueueResponse,
	PinataConfig,
} from "../../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const queue = async (
	config: PinataConfig | undefined,
	options?: PinQueueQuery,
): Promise<PinQueueResponse> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	const params = new URLSearchParams({
		includesCount: "false",
	});

	if (options) {
		const { cid, status, sort, limit, pageToken } = options;

		if (cid) params.append("cid", cid.toString());
		if (status) params.append("status", status.toString());
		if (sort) params.append("sort", sort.toString());
		if (limit) params.append("limit", limit.toString());
		if (pageToken) params.append("pageToken", pageToken.toString());
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	const url = `${endpoint}/files/public/pin_by_cid?${params.toString()}`;

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,

			...config.customHeaders,
		};
	} else {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			Source: "sdk/pinJobs",
		};
	}

	try {
		const request = await fetch(url, {
			method: "GET",
			headers: headers,
		});
		if (!request.ok) {
			const errorData = await request.text();
			if (request.status === 401 || request.status === 403) {
				throw new AuthenticationError(
					`Authentication failed: ${errorData}`,
					request.status,
					{
						error: errorData,
						code: "AUTH_ERROR",
						metadata: {
							requestUrl: request.url,
						},
					},
				);
			}
			throw new NetworkError(`HTTP error: ${errorData}`, request.status, {
				error: errorData,
				code: "HTTP_ERROR",
				metadata: {
					requestUrl: request.url,
				},
			});
		}
		const res = await request.json();
		const resData: PinQueueResponse = res.data;
		return resData;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing pinJobs: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while listing pin jobs");
	}
};
