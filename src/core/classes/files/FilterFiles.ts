import {
	PinataConfig,
	FileListQuery,
	FileListResponse,
	FileListItem,
} from "../../types";
import { listFiles } from "../../functions";

export class FilterFiles {
	private config: PinataConfig | undefined;
	private query: FileListQuery = {};
	private currentPageToken: string | undefined;
	private privacy: "private" | "public";
	// rate limit vars
	// private requestCount = 0;
	// private lastRequestTime = 0;
	// private readonly MAX_REQUESTS_PER_MINUTE = 30;
	// private readonly MINUTE_IN_MS = 60000;

	constructor(config: PinataConfig | undefined, privacy: "private" | "public") {
		this.config = config;
		this.privacy = privacy;
	}

	name(name: string): FilterFiles {
		this.query.name = name;
		return this;
	}

	group(group: string): FilterFiles {
		this.query.group = group;
		return this;
	}

	cid(cid: string): FilterFiles {
		this.query.cid = cid;
		return this;
	}

	mimeType(mimeType: string): FilterFiles {
		this.query.mimeType = mimeType;
		return this;
	}

	order(order: "ASC" | "DESC"): FilterFiles {
		this.query.order = order;
		return this;
	}

	limit(limit: number): FilterFiles {
		this.query.limit = limit;
		return this;
	}

	cidPending(cidPending: boolean): FilterFiles {
		this.query.cidPending = cidPending;
		return this;
	}

	keyvalues(keyvalues: Record<string, string>): FilterFiles {
		this.query.metadata = keyvalues;
		return this;
	}

	noGroup(noGroup: boolean): FilterFiles {
		this.query.noGroup = noGroup;
		return this;
	}

	pageToken(pageToken: string): FilterFiles {
		this.query.pageToken = pageToken;
		return this;
	}

	then(
		onfulfilled?: ((value: FileListResponse) => any) | null,
		onrejected?: ((reason: any) => any) | null,
	): Promise<any> {
		return this.fetchPage().then(onfulfilled, onrejected);
	}

	private async fetchPage(): Promise<FileListResponse> {
		if (this.currentPageToken) {
			this.query.pageToken = this.currentPageToken;
		}
		const response = await listFiles(this.config, this.privacy, this.query);
		this.currentPageToken = response.next_page_token;
		return response;
	}

	// // rate limit, hopefully temporary?
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

	async *[Symbol.asyncIterator](): AsyncGenerator<FileListItem, void, unknown> {
		while (true) {
			const items = await this.fetchPage();
			for (const item of items.files) {
				yield item;
			}
			if (!this.currentPageToken) {
				break;
			}
		}
	}

	async all(): Promise<FileListItem[]> {
		const allItems: FileListItem[] = [];
		for await (const item of this) {
			allItems.push(item);
		}
		return allItems;
	}
}
