import type {
	PinataConfig,
	PinByCIDResponse,
	UploadCIDOptions,
} from "../../types";

import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const uploadCid = async (
	config: PinataConfig | undefined,
	cid: string,
	options?: UploadCIDOptions,
) => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	const jwt: string | undefined = options?.keys || config?.pinataJwt;

	let headers: Record<string, string>;

	if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
		headers = {
			Authorization: `Bearer ${jwt}`,
			"Content-Type": "application/json",
			...config.customHeaders,
		};
	} else {
		headers = {
			Authorization: `Bearer ${jwt}`,
			"Content-Type": "application/json",
			Source: "sdk/cid",
		};
	}

	const requestBody: Record<string, any> = {
		cid: cid,
		name: options?.metadata ? options?.metadata?.name : cid,
		keyvalues: options?.metadata?.keyvalues,
		group_id: options?.groupId,
	};

	if (options?.peerAddresses) {
		requestBody.host_nodes = options.peerAddresses;
	}

	const data = JSON.stringify(requestBody);

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	try {
		const request = await fetch(`${endpoint}/files/public/pin_by_cid`, {
			method: "POST",
			headers: headers,
			body: data,
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
		const resData: PinByCIDResponse = res.data;
		return resData;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing cid: ${error.message}`);
		}
		throw new PinataError("An unknown error occurred while pinning by CID");
	}
};
