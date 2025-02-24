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
		const { ipfs_pin_hash: cid, status, sort, limit } = options;

		if (cid) params.append("ipfs_pin_hash", cid.toString());
		if (status) params.append("status", status.toString());
		if (sort) params.append("sort", sort.toString());
		if (limit) params.append("limit", limit.toString());
	}

	let endpoint: string = "https://api.pinata.cloud";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	const url = `${endpoint}/pinning/pinJobs?${params.toString()}`;

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
		const resData: PinQueueResponse = {
			rows: res.rows.map((row: PinQueueItem) => ({
				...row,
				cid: row.ipfs_pin_hash,
				ipfs_pin_hash: undefined,
			})),
			next_page_token: "", // Assuming API returns this
		};
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
