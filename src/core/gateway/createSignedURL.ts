import type {
	PinataConfig,
	OptimizeImageOptions,
	SignedUrlOptions,
} from "../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const createSignedURL = async (
	config: PinataConfig | undefined,
	options: SignedUrlOptions,
): Promise<string> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	let newUrl: string = `${config?.pinataGateway}/files/${options.cid}`;

	const date = options?.date || Math.floor(new Date().getTime() / 1000);

	const payload = JSON.stringify({
		url: newUrl,
		date: date,
		expires: options.expires,
		method: "GET",
	});

	// const params = new URLSearchParams();
	// if (config?.pinataGatewayKey) {
	// 	params.append("pinataGatewayToken", config.pinataGatewayKey);
	// }

	// if (options) {
	// 	if (options.width) params.append("img-width", options.width.toString());
	// 	if (options.height) params.append("img-height", options.height.toString());
	// 	if (options.dpr) params.append("img-dpr", options.dpr.toString());
	// 	if (options.fit) params.append("img-fit", options.fit);
	// 	if (options.gravity) params.append("img-gravity", options.gravity);
	// 	if (options.quality)
	// 		params.append("img-quality", options.quality.toString());
	// 	if (options.format) params.append("img-format", options.format);
	// 	if (options.animation !== undefined)
	// 		params.append("img-anim", options.animation.toString());
	// 	if (options.sharpen)
	// 		params.append("img-sharpen", options.sharpen.toString());
	// 	if (options.onError === true) params.append("img-onerror", "redirect");
	// 	if (options.metadata) params.append("img-metadata", options.metadata);
	// }

	// const queryString = params.toString();
	// if (queryString) {
	// 	newUrl += `?${queryString}`;
	// }

	try {
		const request = await fetch("https://api.devpinata.cloud/v3/files/sign", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${config?.pinataJwt}`,
			},
			body: payload,
		});

		const res = await request.json();

		if (!request.ok) {
			const errorData = await request.text();
			if (request.status === 401 || request.status === 403) {
				throw new AuthenticationError(
					`Authentication Failed: ${errorData}`,
					request.status,
					errorData,
				);
			}
			throw new NetworkError(
				`HTTP error: ${errorData}`,
				request.status,
				errorData,
			);
		}

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
