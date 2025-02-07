import { PinataConfig } from "../../types";
import { AnalyticsFilter } from "./AnalyticsFilter";

export class AnalyticsRequests extends AnalyticsFilter {
  constructor(config?: PinataConfig) {
    super(config, "", "", ""); // These will need to be set through methods
    this.query.sort_by = "requests";
  }

  updateConfig(newConfig: PinataConfig): void {
    this.config = newConfig;
  }

  customDates(start?: string, end?: string): this {
    if (start) this.query.start_date = start;
    if (end) this.query.end_date = end;
    return this;
  }

  from(domain: string): this {
    this.query.gateway_domain = domain;
    return this;
  }
}
