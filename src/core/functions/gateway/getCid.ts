import type {
	GetCIDResponse,
	PinataConfig,
	OptimizeImageOptions,
} from "../../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const getCid = async (
	config: PinataConfig | undefined,
	cid: string,
	gatewayType?: "ipfs" | "files",
	options?: OptimizeImageOptions,
): Promise<GetCIDResponse> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	let data: JSON | string | Blob;
	let newUrl: string = `${config?.pinataGateway}/${gatewayType}/${cid}`;

	const params = new URLSearchParams();

	if (options) {
		if (options.width) params.append("img-width", options.width.toString());
		if (options.height) params.append("img-height", options.height.toString());
		if (options.dpr) params.append("img-dpr", options.dpr.toString());
		if (options.fit) params.append("img-fit", options.fit);
		if (options.gravity) params.append("img-gravity", options.gravity);
		if (options.quality)
			params.append("img-quality", options.quality.toString());
		if (options.format) params.append("img-format", options.format);
		if (options.animation !== undefined)
			params.append("img-anim", options.animation.toString());
		if (options.sharpen)
			params.append("img-sharpen", options.sharpen.toString());
		if (options.onError === true) params.append("img-onerror", "redirect");
		if (options.metadata) params.append("img-metadata", options.metadata);
	}

	if (config?.pinataGatewayKey) {
		params.append("pinataGatewayToken", config.pinataGatewayKey);
	}

	const queryString = params.toString();
	if (queryString) {
		newUrl += `?${queryString}`;
	}

	if (gatewayType === "ipfs") {
		const request = await fetch(newUrl);

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

		const contentType: string | null =
			request.headers.get("content-type")?.split(";")[0] || null;

		if (contentType?.includes("application/json")) {
			data = await request.json();
		} else if (contentType?.includes("text/")) {
			data = await request.text();
		} else {
			data = await request.blob();
		}

		const res: GetCIDResponse = {
			data: data,
			contentType: contentType,
		};

		return res;
	}

	const date = Math.floor(new Date().getTime() / 1000);

	const payload = JSON.stringify({
		url: newUrl,
		date: date,
		expires: 30,
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
			Source: "sdk/getCid",
		};
	}

	const signedUrlRequest = await fetch(`${endpoint}/files/sign`, {
		method: "POST",
		headers: headers,
		body: payload,
	});

	const signedUrl = await signedUrlRequest.json();

	try {
		const request = await fetch(signedUrl.data);

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

		const contentType: string | null =
			request.headers.get("content-type")?.split(";")[0] || null;

		if (contentType?.includes("application/json")) {
			data = await request.json();
		} else if (contentType?.includes("text/")) {
			data = await request.text();
		} else {
			data = await request.blob();
		}

		const res: GetCIDResponse = {
			data: data,
			contentType: contentType,
		};

		return res;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(`Error processing getCid: ${error.message}`);
		}
		throw new PinataError(
			"An unknown error occurred while getting CID contents",
		);
	}
};
