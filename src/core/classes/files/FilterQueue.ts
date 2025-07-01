import {
	PinQueueItem,
	PinQueueQuery,
	PinQueueResponse,
	PinataConfig,
} from "../../types";
import { queue } from "../../functions";

export class FilterQueue {
	private config: PinataConfig | undefined;
	private query: PinQueueQuery = {};
	private currentPageToken: string | undefined;
	// rate limit vars
	private requestCount = 0;
	private lastRequestTime = 0;
	private readonly MAX_REQUESTS_PER_MINUTE = 30;
	private readonly MINUTE_IN_MS = 60000;

	constructor(config: PinataConfig | undefined) {
		this.config = config;
	}

	cid(cid: string): FilterQueue {
		this.query.cid = cid;
		return this;
	}

	status(
		status:
			| "prechecking"
			| "retrieving"
			| "expired"
			| "backfilled"
			| "over_free_limit"
			| "over_max_size"
			| "invalid_object"
			| "bad_host_node",
	): FilterQueue {
		this.query.status = status;
		return this;
	}

	pageLimit(limit: number): FilterQueue {
		this.query.limit = limit;
		return this;
	}

	pageToken(pageToken: string): FilterQueue {
		this.query.pageToken = pageToken;
		return this;
	}

	private async fetchPage(): Promise<PinQueueResponse> {
		if (this.currentPageToken) {
			this.query.pageToken = this.currentPageToken;
		}
		const response = await queue(this.config, this.query);
		this.currentPageToken = response.next_page_token;
		return response;
	}

	sort(sort: "ASC" | "DSC"): FilterQueue {
		this.query.sort = sort;
		return this;
	}

	then(
		onfulfilled?: ((value: PinQueueResponse) => any) | null,
		onrejected?: ((reason: any) => any) | null,
	): Promise<any> {
		return queue(this.config, this.query).then(onfulfilled, onrejected);
	}

	// rate limit, hopefully temporary?
	private async rateLimit(): Promise<void> {
		this.requestCount++;
		const now = Date.now();
		if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
			const timePassedSinceLastRequest = now - this.lastRequestTime;
			if (timePassedSinceLastRequest < this.MINUTE_IN_MS) {
				const delayTime = this.MINUTE_IN_MS - timePassedSinceLastRequest;
				await new Promise((resolve) => setTimeout(resolve, delayTime));
			}
			this.requestCount = 0;
		}
		this.lastRequestTime = Date.now();
	}

	async *[Symbol.asyncIterator](): AsyncGenerator<PinQueueItem, void, unknown> {
		while (true) {
			const items = await this.fetchPage();
			for (const item of items.jobs) {
				yield item;
			}
			if (!this.currentPageToken) {
				break;
			}
		}
	}

	async all(): Promise<PinQueueItem[]> {
		const allItems: PinQueueItem[] = [];
		for await (const item of this) {
			allItems.push(item);
		}
		return allItems;
	}
}
