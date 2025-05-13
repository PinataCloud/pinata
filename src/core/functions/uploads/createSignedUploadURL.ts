import type { PinataConfig, SignedUploadUrlOptions } from "../../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const createSignedUploadURL = async (
	config: PinataConfig | undefined,
	options: SignedUploadUrlOptions,
	network: "public" | "private",
): Promise<string> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	type PayloadData = {
		date: number;
		expires: number;
		group_id?: string;
		filename?: string;
		keyvalues?: Record<string, string>;
		network?: "public" | "private";
		max_file_size?: number;
		allow_mime_types?: string[];
		streamable?: boolean;
	};

	const date = options?.date || Math.floor(new Date().getTime() / 1000);

	const payload: PayloadData = {
		date: date,
		expires: options.expires,
	};

	if (options.groupId) {
		payload.group_id = options.groupId;
	}

	if (options.name) {
		payload.filename = options.name;
	}

	if (options.keyvalues) {
		payload.keyvalues = options.keyvalues;
	}

	if (network) {
		payload.network = network;
	}

	if (options.streamable) {
		payload.streamable = options.streamable;
	}

	if (options.maxFileSize) {
		payload.max_file_size = options.maxFileSize;
	}

	if (options.mimeTypes) {
		payload.allow_mime_types = options.mimeTypes;
	}

	let endpoint: string = "https://uploads.pinata.cloud/v3";

	if (config.uploadUrl) {
		endpoint = config.uploadUrl;
	}

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			"Content-Type": "application/json",
			...config.customHeaders,
		};
	} else {
		headers = {
			"Content-Type": "application/json",
			Authorization: `Bearer ${config.pinataJwt}`,
			Source: "sdk/createSignURL",
		};
	}

	try {
		const request = await fetch(`${endpoint}/files/sign`, {
			method: "POST",
			headers: headers,
			body: JSON.stringify(payload),
		});

		if (!request.ok) {
			const errorData = await request.text();
			if (request.status === 401 || request.status === 403) {
				throw new AuthenticationError(
					`Authentication Failed: ${errorData}`,
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
		return res.data;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(
				`Error processing createSignedURL: ${error.message}`,
			);
		}
		throw new PinataError("An unknown error occurred while getting signed url");
	}
};
