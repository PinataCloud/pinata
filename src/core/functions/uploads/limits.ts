// The upload limits of the account a JWT belongs to.

import { NetworkError, ValidationError } from "../../../utils/custom-errors";
import type { PinataConfig, UploadLimits } from "../../types";
import { refused, unreachable } from "./uploadErrors";

const DEFAULT_UPLOAD_URL = "https://uploads.pinata.cloud/v3";

// Asks `endpoint` (the upload API, e.g. https://uploads.pinata.cloud/v3) for the limits of
// the account `headers` authenticate
export const fetchUploadLimits = async (
	endpoint: string,
	headers: Record<string, string>,
	signal?: AbortSignal,
): Promise<UploadLimits> => {
	const requestUrl = `${endpoint}/files/limits`;
	const action = "Could not get the upload limits";
	let res: Response;
	try {
		res = await fetch(requestUrl, { method: "GET", headers, signal });
	} catch (error) {
		throw unreachable(error, { requestUrl }, action);
	}
	if (!res.ok) {
		throw refused(action, res.status, await res.text().catch(() => ""), {
			requestUrl,
		});
	}
	const body = await res.json().catch(() => undefined);
	const limits = body?.data;
	const max = limits?.folder_max_files;
	if (!Number.isInteger(max) || max <= 0) {
		throw new NetworkError(`${action}: unexpected answer`, res.status, {
			error: JSON.stringify(body),
			code: "HTTP_ERROR",
			metadata: { requestUrl },
		});
	}
	return limits as UploadLimits;
};

export const getUploadLimits = async (
	config: PinataConfig | undefined,
): Promise<UploadLimits> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}
	const headers: Record<string, string> =
		config.customHeaders && Object.keys(config.customHeaders).length > 0
			? {
					Authorization: `Bearer ${config.pinataJwt}`,
					...config.customHeaders,
				}
			: {
					Authorization: `Bearer ${config.pinataJwt}`,
					Source: "sdk/uploadLimits",
				};
	return fetchUploadLimits(config.uploadUrl || DEFAULT_UPLOAD_URL, headers);
};
