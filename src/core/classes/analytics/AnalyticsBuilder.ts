import type { AnalyticsQuery, PinataConfig } from '../../types';

export class AnalyticsBuilder<T extends AnalyticsQuery, R> {
  protected config: PinataConfig | undefined;
  protected query: T;
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly MAX_REQUESTS_PER_MINUTE = 30;
  private readonly MINUTE_IN_MS = 60000;

  constructor(config: PinataConfig | undefined, query: T) {
    this.config = config;
    this.query = query;
  }

  cid(cid: string): this {
    this.query.cid = cid;
    return this;
  }

  fileName(fileName: string): this {
    this.query.file_name = fileName;
    return this;
  }

  userAgent(userAgent: string): this {
    this.query.user_agent = userAgent;
    return this;
  }

  country(country: string): this {
    this.query.country = country;
    return this;
  }

  region(region: string): this {
    this.query.region = region;
    return this;
  }

  referer(referer: string): this {
    this.query.referer = referer;
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

  // private async rateLimit(): Promise<void> {
  // 	this.requestCount++;
  // 	const now = Date.now();
  // 	if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
  // 		const timePassedSinceLastRequest = now - this.lastRequestTime;
  // 		if (timePassedSinceLastRequest < this.MINUTE_IN_MS) {
  // 			const delayTime = this.MINUTE_IN_MS - timePassedSinceLastRequest;
  // 			await new Promise((resolve) => setTimeout(resolve, delayTime));
  // 		}
  // 		this.requestCount = 0;
  // 	}
  // 	this.lastRequestTime = Date.now();
  // }

  protected async getAnalytics(): Promise<R> {
    //await this.rateLimit();
    throw new Error("getAnalytics method must be implemented in derived class");
  }

  then(onfulfilled?: ((value: R) => any) | null): Promise<any> {
    return this.getAnalytics().then(onfulfilled);
  }
}
