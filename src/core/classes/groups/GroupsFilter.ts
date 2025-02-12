import type {
  PinataConfig,
  GroupQueryOptions,
  GroupListResponse,
  GroupResponseItem
} from "../../types";
import { listGroups } from "../../functions";

export class FilterGroups {
  private config: PinataConfig | undefined;
  private query: GroupQueryOptions = {};
  private privacy: "private" | "public"
  // rate limit vars
  // private requestCount = 0;
  // private lastRequestTime = 0;
  // private readonly MAX_REQUESTS_PER_MINUTE = 30;
  // private readonly MINUTE_IN_MS = 60000;
  private nextPageToken: string | undefined;

  constructor(config: PinataConfig | undefined, privacy: "private" | "public") {
    this.config = config;
    this.privacy = privacy;
  }

  name(name: string): FilterGroups {
    this.query.name = name;
    return this;
  }

  limit(limit: number): FilterGroups {
    this.query.limit = limit;
    return this;
  }

  isPublic(isPublic: boolean): FilterGroups {
    this.query.isPublic = isPublic;
    return this;
  }

  pageToken(pageToken: string): FilterGroups {
    this.query.pageToken = pageToken;
    return this;
  }

  then(
    onfulfilled?: ((value: GroupListResponse) => any) | null,
  ): Promise<GroupListResponse> {
    return this.fetchPage()
      .then((response) => {
        this.nextPageToken = response.next_page_token;
        return response;
      })
      .then(onfulfilled);
  }

  private async fetchPage(): Promise<GroupListResponse> {
    if (this.nextPageToken) {
      this.query.pageToken = this.nextPageToken;
    }
    return listGroups(this.config, this.privacy, this.query);
  }

  // rate limit, hopefully temporary?
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

  async *[Symbol.asyncIterator](): AsyncGenerator<
    GroupResponseItem,
    void,
    unknown
  > {
    while (true) {
      const response = await this.fetchPage();
      for (const item of response.groups) {
        yield item;
      }
      if (!response.next_page_token) {
        break;
      }
      this.nextPageToken = response.next_page_token;
    }
  }

  async all(): Promise<GroupResponseItem[]> {
    const allItems: GroupResponseItem[] = [];
    for await (const item of this) {
      allItems.push(item);
    }
    return allItems;
  }
}
