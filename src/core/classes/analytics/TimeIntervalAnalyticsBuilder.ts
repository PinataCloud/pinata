import { AnalyticsBuilder } from './AnalyticsBuilder';
import { TimeIntervalAnalyticsQuery, TimeIntervalAnalyticsResponse, PinataConfig } from '../../types';
import { analyticsDateInterval } from '../../functions';

export class TimeIntervalAnalyticsBuilder extends AnalyticsBuilder<
  TimeIntervalAnalyticsQuery,
  TimeIntervalAnalyticsResponse
> {
  constructor(
    config: PinataConfig | undefined,
    domain: string,
    start: string,
    end: string,
    dateInterval: "day" | "week",
  ) {
    super(config, {
      gateway_domain: domain,
      start_date: start,
      end_date: end,
      date_interval: dateInterval,
    });
  }

  sortBy(sortBy: "requests" | "bandwidth"): this {
    this.query.sort_by = sortBy;
    return this;
  }

  protected async getAnalytics(): Promise<TimeIntervalAnalyticsResponse> {
    return analyticsDateInterval(this.config, this.query);
  }

  async all(): Promise<TimeIntervalAnalyticsResponse> {
    return this.getAnalytics();
  }
}
