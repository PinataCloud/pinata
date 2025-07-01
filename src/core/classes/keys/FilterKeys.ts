import { listKeys } from "../../functions";
import type { PinataConfig, KeyListQuery, KeyListItem } from "../../types";

export class FilterKeys {
	private config: PinataConfig | undefined;
	private query: KeyListQuery = {};
	// rate limit vars
	// private requestCount = 0;
	// private lastRequestTime = 0;
	// private readonly MAX_REQUESTS_PER_MINUTE = 30;
	// private readonly MINUTE_IN_MS = 60000;

	constructor(config: PinataConfig | undefined) {
		this.config = config;
	}

	offset(offset: number): FilterKeys {
		this.query.offset = offset;
		return this;
	}

	revoked(revoked: boolean): FilterKeys {
		this.query.revoked = revoked;
		return this;
	}

	limitedUse(limitedUse: boolean): FilterKeys {
		this.query.limitedUse = limitedUse;
		return this;
	}

	exhausted(exhausted: boolean): FilterKeys {
		this.query.exhausted = exhausted;
		return this;
	}

	name(name: string): FilterKeys {
		this.query.name = name;
		return this;
	}

	then(
		onfulfilled?: ((value: KeyListItem[]) => any) | null,
		onrejected?: ((reason: any) => any) | null,
	): Promise<any> {
		return listKeys(this.config, this.query).then(onfulfilled, onrejected);
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

	async *[Symbol.asyncIterator](): AsyncGenerator<KeyListItem, void, unknown> {
		let hasMore = true;
		let offset = 0;

		while (hasMore) {
			//await this.rateLimit(); // applying rate limit
			this.query.offset = offset;

			const items = await listKeys(this.config, this.query);

			for (const item of items) {
				yield item;
			}

			if (items.length === 0) {
				hasMore = false;
			} else {
				offset += items.length;
			}
		}
	}

	async all(): Promise<KeyListItem[]> {
		const allItems: KeyListItem[] = [];
		for await (const item of this) {
			allItems.push(item);
		}
		return allItems;
	}
}
