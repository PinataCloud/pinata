import type {
	FileListQuery,
	FileListResponse,
	PinataConfig,
} from "../../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const listFiles = async (
	config: PinataConfig | undefined,
	privacy: "private" | "public",
	options?: FileListQuery,
): Promise<FileListResponse> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	const params = new URLSearchParams();

	if (options) {
		const {
			name,
			group,
			cid,
			order,
			limit,
			mimeType,
			pageToken,
			cidPending,
			metadata,
			noGroup,
		} = options;

		if (limit) params.append("limit", limit.toString());
		if (name) params.append("name", name);
		if (group) params.append("group", group);
		if (cid) params.append("cid", cid);
		if (mimeType) params.append("mimeType", mimeType);
		if (order) params.append("order", order);
		if (pageToken) params.append("pageToken", pageToken);
		if (cidPending) params.append("cidPending", "true");
		if (noGroup) params.append("group", "null");
		if (metadata && typeof metadata === "object") {
			Object.entries(metadata).forEach(([key, value]) => {
				params.append(`keyvalues[${key.toString()}]`, value.toString());
			});
		}
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	const url = `${endpoint}/files/${privacy}?${params.toString()}`;

	try {
		let headers: Record<string, string>;

		if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
			headers = {
				Authorization: `Bearer ${config.pinataJwt}`,
				...config.customHeaders,
			};
		} else {
			headers = {
				Authorization: `Bearer ${config.pinataJwt}`,
				Source: "sdk/listFiles",
			};
		}

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
		const resData: FileListResponse = res.data;
		return resData;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing list files: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while listing files");
	}
};
