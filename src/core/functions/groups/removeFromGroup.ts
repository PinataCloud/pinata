import type {
	GroupCIDOptions,
	PinataConfig,
	UpdateGroupFilesResponse,
} from "../../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const removeFromGroup = async (
	config: PinataConfig | undefined,
	options: GroupCIDOptions,
	privacy: "public" | "private",
): Promise<UpdateGroupFilesResponse[]> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	const wait = (milliseconds: number): Promise<void> => {
		return new Promise((resolve) => {
			setTimeout(resolve, milliseconds);
		});
	};

	const responses: UpdateGroupFilesResponse[] = [];

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
			Source: "sdk/addToGroup",
		};
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	for (const id of options.files) {
		try {
			const response = await fetch(
				`${endpoint}/groups/${privacy}/${options.groupId}/ids/${id}`,
				{
					method: "DELETE",
					headers: headers,
				},
			);

			await wait(300);

			if (!response.ok) {
				const errorData = await response.text();
				if (response.status === 401) {
					throw new AuthenticationError(
						`Authentication failed: ${errorData}`,
						response.status,
						{
							error: errorData,
							code: "AUTH_ERROR",
							metadata: {
								requestUrl: response.url,
							},
						},
					);
				}
				throw new NetworkError(`HTTP error: ${errorData}`, response.status, {
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
				errorMessage = `Error adding file ${id} to group: ${error.message}`;
			} else {
				errorMessage = `An unknown error occurred while adding file ${id} to group`;
			}

			responses.push({
				id: id,
				status: errorMessage,
			});
		}
	}
	return responses;
};
