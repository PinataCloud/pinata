import type {
	TimeIntervalAnalyticsQuery,
	TimeIntervalAnalyticsResponse,
	PinataConfig,
} from "../../types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../../utils/custom-errors";

export const analyticsDateInterval = async (
	config: PinataConfig | undefined,
	options?: TimeIntervalAnalyticsQuery,
): Promise<TimeIntervalAnalyticsResponse> => {
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

	let endpoint: string = "https://api.pinata.cloud/v3";

	if (config.endpointUrl) {
		endpoint = config.endpointUrl;
	}

	const url = `${endpoint}/ipfs/gateway_analytics_time_series?${params.toString()}`;

	try {
		let headers: Record<string, string>;

		if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
			headers = { ...config.customHeaders };
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
		const resData: TimeIntervalAnalyticsResponse = res.data;
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
