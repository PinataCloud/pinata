/**
 * Retrieves gateway analytics data for a specified time interval from Pinata.
 *
 * This function fetches analytics data for Pinata gateways, allowing for various
 * filtering options and time interval specifications.
 *
 * @async
 * @function analyticsDateInterval
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {TimeIntervalGatewayAnalyticsQuery} [options] - Optional query parameters to filter and customize the analytics results.
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
 * @param {"day" | "week"} [options.date_interval] - The time interval for grouping results.
 * @param {"requests" | "bandwidth"} [options.sort_by] - Sort the results by requests or bandwidth.
 * @returns {Promise<TimeIntervalGatewayAnalyticsResponse>} A promise that resolves to an object containing the analytics data.
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
 *  const analytics = await pinata.gateways.dateIntervalAnalytics({
 *    domain: "example-gateway.mypinata.cloud",
 *    start: "2024-08-01",
 *    end: "2024-08-15",
 *    interval: "day"
 *  }).sortBy("bandwidth");
 */

import type {
	TimeIntervalGatewayAnalyticsQuery,
	TimeIntervalGatewayAnalyticsResponse,
	PinataConfig,
} from "../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils/custom-errors";

export const analyticsDateInterval = async (
	config: PinataConfig | undefined,
	options?: TimeIntervalGatewayAnalyticsQuery,
): Promise<TimeIntervalGatewayAnalyticsResponse> => {
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
			date_interval,
			sort_by,
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
		if (date_interval) params.append("by", date_interval);
	}

	let endpoint: string = "https://api.pinata.cloud";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	const url = `${endpoint}/v3/ipfs/gateway_analytics_time_series?${params.toString()}`;

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
				Source: "sdk/analyticsDateInterval",
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
		const resData: TimeIntervalGatewayAnalyticsResponse = res.data;
		return resData;
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
