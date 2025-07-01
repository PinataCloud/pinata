import {
	PinataConfig,
	TopAnalyticsQuery,
	TopAnalyticsResponse,
} from "../../types";
import { analyticsTopUsage } from "../../functions";
import { calculateDates } from "./utils";

export class AnalyticsFilter {
	protected config: PinataConfig | undefined;
	protected query: TopAnalyticsQuery;

	constructor(
		config: PinataConfig | undefined,
		domain: string,
		start: string,
		end: string,
	) {
		this.config = config;
		this.query = {
			gateway_domain: domain,
			start_date: start,
			end_date: end,
			sort_by: "requests", // Will be overridden in child classes
			attribute: "cid",
		};
	}

	cid(cid?: string): this {
		this.query.attribute = "cid";
		if (cid) {
			this.query.cid = cid;
		}
		return this;
	}

	fileName(fileName?: string): this {
		this.query.attribute = "file_name";
		if (fileName) {
			this.query.file_name = fileName;
		}
		return this;
	}

	userAgent(userAgent?: string): this {
		this.query.attribute = "user_agent";
		if (userAgent) {
			this.query.user_agent = userAgent;
		}
		return this;
	}

	country(country?: string): this {
		this.query.attribute = "country";
		if (country) {
			this.query.country = country;
		}
		return this;
	}

	region(region?: string): this {
		this.query.attribute = "region";
		if (region) {
			this.query.region = region;
		}
		return this;
	}

	referer(referer?: string): this {
		this.query.attribute = "referer";
		if (referer) {
			this.query.referer = referer;
		}
		return this;
	}

	limit(limit: number): this {
		this.query.limit = limit;
		return this;
	}

	sort(order: "asc" | "desc"): this {
		this.query.sort_order = order;
		return this;
	}

	days(numberOfDays: number): this {
		const { start, end } = calculateDates(numberOfDays);
		this.query.start_date = start;
		this.query.end_date = end;
		return this;
	}

	then(
		onfulfilled?: ((value: TopAnalyticsResponse) => any) | null,
		onrejected?: ((reason: any) => any) | null,
	): Promise<any> {
		return analyticsTopUsage(this.config, this.query).then(onfulfilled, onrejected);
	}
}
