import type {
	PinataConfig,
	OptimizeImageOptions,
	AccessLinkOptions,
} from "../../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const createAccessLink = async (
	config: PinataConfig | undefined,
	options: AccessLinkOptions,
	imgOpts: OptimizeImageOptions,
): Promise<string> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	let baseUrl: string | undefined;

	if (options?.gateway) {
		baseUrl = options.gateway.startsWith("https://")
			? options.gateway
			: `https://${options.gateway}`;
	} else {
		baseUrl = config.pinataGateway;
	}

	let newUrl: string = `${baseUrl}/files/${options.cid}`;

	const params = new URLSearchParams();

	if (imgOpts) {
		if (imgOpts.width) params.append("img-width", imgOpts.width.toString());
		if (imgOpts.height) params.append("img-height", imgOpts.height.toString());
		if (imgOpts.dpr) params.append("img-dpr", imgOpts.dpr.toString());
		if (imgOpts.fit) params.append("img-fit", imgOpts.fit);
		if (imgOpts.gravity) params.append("img-gravity", imgOpts.gravity);
		if (imgOpts.quality)
			params.append("img-quality", imgOpts.quality.toString());
		if (imgOpts.format) params.append("img-format", imgOpts.format);
		if (imgOpts.animation !== undefined)
			params.append("img-anim", imgOpts.animation.toString());
		if (imgOpts.sharpen)
			params.append("img-sharpen", imgOpts.sharpen.toString());
		if (imgOpts.onError === true) params.append("img-onerror", "redirect");
		if (imgOpts.metadata) params.append("img-metadata", imgOpts.metadata);
	}

	const queryString = params.toString();

	if (queryString) {
		newUrl += `?${queryString}`;
	}

	const date = options?.date || Math.floor(new Date().getTime() / 1000);

	const payload = JSON.stringify({
		url: newUrl,
		date: date,
		expires: options.expires,
		method: "GET",
	});

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
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
		const request = await fetch(`${endpoint}/files/private/download_link`, {
			method: "POST",
			headers: headers,
			body: payload,
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
