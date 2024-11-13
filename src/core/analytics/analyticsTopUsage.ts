/**
 * Retrieves top gateway analytics data from Pinata.
 *
 * This function fetches top analytics data for Pinata gateways, allowing for various
 * filtering options and customization of the results.
 *
 * @async
 * @function analyticsTopUsage
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {TopGatewayAnalyticsQuery} [options] - Optional query parameters to filter and customize the analytics results.
 * @param {string} [options.cid] - Filter by the CID of the file.
 * @param {string} [options.gateway_domain] - The gateway domain to fetch analytics for.
 * @param {string} [options.start_date] - The start date for the analytics period (ISO 8601 format).
 * @param {string} [options.end_date] - The end date for the analytics period (ISO 8601 format).
 * @param {string} [options.file_name] - Filter by file name.
 * @param {string} [options.user_agent] - Filter by user agent.
 * @param {string} [options.country] - Filter by country.
 * @param {string} [options.region] - Filter by region.
 * @param {string} [options.referer] - Filter by referer.
 * @param {number} [options.limit] - Limit the number of results.
 * @param {"asc" | "desc"} [options.sort_order] - Sort order for the results.
 * @param {"requests" | "bandwidth"} [options.sort_by] - Sort the results by requests or bandwidth.
 * @param {"cid" | "country" | "region" | "user_agent" | "referer" | "file_name"} [options.attribute] - Group results by this attribute.
 * @returns {Promise<TopGatewayAnalyticsItem[]>} A promise that resolves to an array of top gateway analytics items.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the analytics retrieval process.
 *
 * @example
 *  import { PinataSDK } from "pinata";
 *
 *  const pinata = new PinataSDK({
 *    pinataJwt: process.env.PINATA_JWT!,
 *    pinataGateway: "example-gateway.mypinata.cloud",
 *  });
 *
 *  const topAnalytics = await pinata.gateways.topUsageAnalytics({
 *    domain: "example-gateway.mypinata.cloud",
 *    start: "2024-08-01",
 *    end: "2024-08-15",
 *    sortBy: "requests",
 *    attribute: "cid"
 *  }).cid("QmVLwvmGehsrNEvhcCnnsw5RQNseohgEkFNN1848zNzdng").sort("asc");
 */

import type {
	TopAnalyticsQuery,
	TopAnalyticsItem,
	PinataConfig,
	TopAnalyticsResponse,
} from "../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const analyticsTopUsage = async (
	config: PinataConfig | undefined,
	options?: TopAnalyticsQuery,
): Promise<TopAnalyticsResponse> => {
	if (!config) {
		throw new ValidationError("Pinata configuration is missing");
	}

	const params = new URLSearchParams();

	if (options) {
		const {
			cid,
			gateway_domain,
			start_date,
			end_date,
			file_name,
			user_agent,
			country,
			region,
			referer,
			limit,
			sort_order,
			sort_by,
			attribute,
		} = options;

		if (cid) params.append("cid", cid);
		if (gateway_domain) params.append("gateway_domain", gateway_domain);
		if (start_date) params.append("start_date", start_date);
		if (end_date) params.append("end_date", end_date);
		if (file_name) params.append("file_name", file_name);
		if (user_agent) params.append("user_agent", user_agent.toString());
		if (country) params.append("country", country.toString());
		if (region) params.append("region", region);
		if (referer) params.append("referer", referer.toString());
		if (limit) params.append("limit", limit.toString());
		if (sort_order) params.append("sort_order", sort_order);
		if (sort_by) params.append("sort_by", sort_by);
		if (attribute) params.append("by", attribute);
	}

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	const url = `${endpoint}/ipfs/gateway_analytics_top?${params.toString()}`;

	try {
		let headers: Record<string, string>;

		if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
			headers = { ...config.customHeaders };
		} else {
			headers = {
				Authorization: `Bearer ${config.pinataJwt}`,
				Source: "sdk/analyticsTopUsage",
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

		const res: TopAnalyticsResponse = await request.json();
		return res;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}
		if (error instanceof Error) {
			throw new PinataError(
				`Error processing anaytics usage: ${error.message}`,
			);
		}
		throw new PinataError(
			"An unknown error occurred while fetching gateway usage",
		);
	}
};
