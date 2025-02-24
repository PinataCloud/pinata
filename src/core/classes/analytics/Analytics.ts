import type { PinataConfig } from "../../types/";
import {
	AnalyticsRequests,
	AnalyticsBandwidth,
	TimeIntervalAnalyticsBuilder,
} from "./";
import { formatConfig } from "../../../utils/format-config";

export class Analytics {
	config: PinataConfig | undefined;
	requests: AnalyticsRequests;
	bandwidth: AnalyticsBandwidth;

	constructor(config?: PinataConfig) {
		this.config = formatConfig(config);
		this.requests = new AnalyticsRequests(this.config);
		this.bandwidth = new AnalyticsBandwidth(this.config);
	}

	updateConfig(newConfig: PinataConfig): void {
		this.config = newConfig;
		this.requests.updateConfig(newConfig);
		this.bandwidth.updateConfig(newConfig);
	}

	summary(options: {
		domain: string;
		start: string;
		end: string;
		interval: "day" | "week";
	}): TimeIntervalAnalyticsBuilder {
		return new TimeIntervalAnalyticsBuilder(
			this.config,
			options.domain,
			options.start,
			options.end,
			options.interval,
		);
	}
}
