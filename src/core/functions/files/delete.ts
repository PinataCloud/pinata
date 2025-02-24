import type { PinataConfig, DeleteResponse } from "../../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

const wait = (milliseconds: number): Promise<void> => {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
};

export const deleteFile = async (
	config: PinataConfig | undefined,
	files: string[],
	privacy: "public" | "private",
): Promise<DeleteResponse[]> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	const responses: DeleteResponse[] = [];

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			...config.customHeaders,
		};
	} else {
		headers = {
			Authorization: `Bearer ${config.pinataJwt}`,
			Source: "sdk/deleteFile",
		};
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	for (const id of files) {
		try {
			const response = await fetch(`${endpoint}/files/${privacy}/${id}`, {
				method: "DELETE",
				headers: headers,
			});

			await wait(300);

			if (!response.ok) {
				const errorData = await response.text();
				if (response.status === 401) {
					throw new AuthenticationError(
						`Authentication failed: ${errorData}`,
						response.status,
						{
							error: errorData,
							code: "HTTP_ERROR",
							metadata: {
								requestUrl: response.url,
							},
						},
					);
				}
				throw new NetworkError(`HTTP error`, response.status, {
					error: errorData,
					code: "HTTP_ERROR",
					metadata: {
						requestUrl: response.url,
					},
				});
			}

			responses.push({
				id: id,
				status: response.statusText,
			});
		} catch (error) {
			let errorMessage: string;

			if (error instanceof PinataError) {
				errorMessage = error.message;
			} else if (error instanceof Error) {
				errorMessage = `Error deleting file ${id}: ${error.message}`;
			} else {
				errorMessage = `An unknown error occurred while deleting file ${id}`;
			}

			responses.push({
				id: id,
				status: errorMessage,
			});
		}
	}
	return responses;
};
