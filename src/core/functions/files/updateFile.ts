import type {
	FileListItem,
	PinataConfig,
	UpdateFileOptions,
} from "../../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const updateFile = async (
	config: PinataConfig | undefined,
	options: UpdateFileOptions,
	privacy: "public" | "private",
): Promise<FileListItem> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	if (
		!options.name &&
		(!options.keyvalues || Object.keys(options.keyvalues).length === 0) &&
		options.expires_at === undefined
	) {
		throw new ValidationError(
			"At least one of 'name', 'keyvalues', or 'expires_at' must be provided",
		);
	}

	const data: Record<string, any> = {};

	if (options.name !== undefined) {
		data.name = options.name;
	}
	if (options.keyvalues && Object.keys(options.keyvalues).length > 0) {
		data.keyvalues = options.keyvalues;
	}
	if (options.expires_at !== undefined) {
		data.expires_at = options.expires_at;
	}

	const body = JSON.stringify(data);

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			"Content-Type": "application/json",
			...config.customHeaders,
		};
	} else {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			"Content-Type": "application/json",
			Source: "sdk/updateMetadata",
		};
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(`${endpoint}/files/${privacy}/${options.id}`, {
			method: "PUT",
			headers: headers,
			body: body,
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
		const resData: FileListItem = res.data;
		return resData;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing updateFile: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while updating file");
	}
};
