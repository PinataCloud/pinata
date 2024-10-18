/**
 * Lists files pinned to Pinata based on the provided configuration and options.
 *
 * This function fetches a list of pinned files from the Pinata API, allowing for
 * various filtering and pagination options.
 *
 * @async
 * @function listFiles
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {FileListQuery} [options] - Optional query parameters to filter and paginate the results.
 * @param {string} [options.cid] - Filter by the CID of the file.
 * @param {string} [options.pinStart] - Filter by the start date of pinning (ISO 8601 format).
 * @param {string} [options.pinEnd] - Filter by the end date of pinning (ISO 8601 format).
 * @param {number} [options.pinSizeMin] - Filter by minimum pin size in bytes.
 * @param {number} [options.pinSizeMax] - Filter by maximum pin size in bytes.
 * @param {number} [options.pageLimit] - Number of items to return per page.
 * @param {number} [options.pageOffset] - Number of items to skip (for pagination).
 * @param {string} [options.name] - Filter by the name of the file.
 * @param {string} [options.key] - Metadata key to filter by (used with value and operator).
 * @param {string | number} [options.value] - Metadata value to filter by (used with key and operator).
 * @param {string} [options.operator] - Comparison operator for metadata filtering.
 * @param {string} [options.groupId] - Filter by group ID.
 * @returns {Promise<FileListItem[]>} A promise that resolves to an array of FileListItem objects.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the file listing process.
 *//**
 * Lists files pinned to Pinata based on the provided configuration and options.
 *
 * This function fetches a list of pinned files from the Pinata API, allowing for
 * various filtering and pagination options.
 *
 * @async
 * @function listFiles
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {FileListQuery} [options] - Optional query parameters to filter and paginate the results.
 * @param {string} [options.cid] - Filter by the CID of the file.
 * @param {string} [options.pinStart] - Filter by the start date of pinning (ISO 8601 format).
 * @param {string} [options.pinEnd] - Filter by the end date of pinning (ISO 8601 format).
 * @param {number} [options.pinSizeMin] - Filter by minimum pin size in bytes.
 * @param {number} [options.pinSizeMax] - Filter by maximum pin size in bytes.
 * @param {number} [options.pageLimit] - Number of items to return per page.
 * @param {number} [options.pageOffset] - Number of items to skip (for pagination).
 * @param {string} [options.name] - Filter by the name of the file.
 * @param {string} [options.key] - Metadata key to filter by (used with value and operator).
 * @param {string | number} [options.value] - Metadata value to filter by (used with key and operator).
 * @param {string} [options.operator] - Comparison operator for metadata filtering.
 * @param {string} [options.groupId] - Filter by group ID.
 * @returns {Promise<FileListItem[]>} A promise that resolves to an array of FileListItem objects.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the file listing process.
 * @example
 *  import { PinataSDK } from "pinata";
 *
 *  const pinata = new PinataSDK({
 *    pinataJwt: process.env.PINATA_JWT!,
 *    pinataGateway: "example-gateway.mypinata.cloud",
 *  });
 *
 *  const files = await pinata.listFiles().name("pinnie")
 */

import type { FileListQuery, FileListResponse, PinataConfig } from "../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const listFiles = async (
	config: PinataConfig | undefined,
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
				params.append(`metadata[${key}]`, value.toString());
			});
		}
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	const url = `${endpoint}/files?${params.toString()}`;

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
					errorData,
				);
			}
			throw new NetworkError(
				`HTTP error: ${errorData}`,
				request.status,
				errorData,
			);
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
