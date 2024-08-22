import type {
	FileObject,
	PinByCIDResponse,
	PinListItem,
	PinListQuery,
	PinResponse,
	PinataConfig,
	PinataMetadata,
	PinataMetadataUpdate,
	UploadCIDOptions,
	UploadOptions,
	GetCIDResponse,
	PinJobQuery,
	PinJobItem,
	KeyOptions,
	KeyResponse,
	KeyListQuery,
	KeyListItem,
	GroupOptions,
	GroupResponseItem,
	UpdateGroupOptions,
	GroupCIDOptions,
	GroupQueryOptions,
	GetGroupOptions,
	AuthTestResponse,
	UnpinResponse,
	RevokeKeyResponse,
	SignatureOptions,
	SignatureResponse,
	TopGatewayAnalyticsQuery,
	TopGatewayAnalyticsItem,
	TimeIntervalGatewayAnalyticsQuery,
	GatewayAnalyticsQuery,
	TimeIntervalGatewayAnalyticsResponse,
	SwapCidOptions,
	SwapCidResponse,
	SwapHistoryOptions,
} from "./types";
import { testAuthentication } from "./authentication/testAuthentication";
import { uploadFile } from "./pinning/file";
import { uploadFileArray } from "./pinning/fileArray";
import { uploadBase64 } from "./pinning/base64";
import { uploadUrl } from "./pinning/url";
import { uploadJson } from "./pinning/json";
import { uploadCid } from "./pinning/cid";
import { unpinFile } from "./pinning/unpin";
import { listFiles } from "./data/listFiles";
import { updateMetadata } from "./data/updateMetadata";
import { getCid } from "./gateway/getCid";
import { convertIPFSUrl } from "./gateway/convertIPFSUrl";
import { pinJobs } from "./data/pinJobs";
import { pinnedFileCount } from "./data/pinnedFileUsage";
import { totalStorageUsage } from "./data/totalStorageUsage";
import { createKey } from "./keys/createKey";
import { listKeys } from "./keys/listKeys";
import { revokeKeys } from "./keys/revokeKeys";
import { createGroup } from "./groups/createGroup";
import { listGroups } from "./groups/listGroups";
import { getGroup } from "./groups/getGroup";
import { addToGroup } from "./groups/addToGroup";
import { updateGroup } from "./groups/updateGroup";
import { removeFromGroup } from "./groups/removeFromGroup";
import { deleteGroup } from "./groups/deleteGroup";
import { addSignature } from "./signatures/addSignature";
import { getSignature } from "./signatures/getSignature";
import { removeSignature } from "./signatures/removeSignature";
import { analyticsTopUsage } from "./gateway/analyticsTopUsage";
import { analyticsDateInterval } from "./gateway/analyticsDateInterval";
import { swapCid } from "./gateway/swapCid";
import { swapHistory } from "./gateway/swapHistory";
import { deleteSwap } from "./gateway/deleteSwap";

const formatConfig = (config: PinataConfig | undefined) => {
	let gateway = config?.pinataGateway;
	if (config && gateway) {
		if (gateway && !gateway.startsWith("https://")) {
			gateway = `https://${gateway}`;
		}
		config.pinataGateway = gateway;
	}
	return config;
};

export class PinataSDK {
	config: PinataConfig | undefined;
	upload: Upload;
	gateways: Gateways;
	usage: Usage;
	keys: Keys;
	groups: Groups;
	signatures: Signatures;

	constructor(config?: PinataConfig) {
		this.config = formatConfig(config);
		this.upload = new Upload(this.config);
		this.gateways = new Gateways(this.config);
		this.usage = new Usage(this.config);
		this.keys = new Keys(this.config);
		this.groups = new Groups(this.config);
		this.signatures = new Signatures(this.config);
	}

	setNewHeaders(headers: Record<string, string>): void {
		if (!this.config) {
			this.config = { pinataJwt: "", customHeaders: {} };
		}
		this.config.customHeaders = { ...this.config.customHeaders, ...headers };

		// Update headers for all sub-modules
		this.upload.updateConfig(this.config);
		this.gateways.updateConfig(this.config);
		this.usage.updateConfig(this.config);
		this.keys.updateConfig(this.config);
		this.groups.updateConfig(this.config);
		this.signatures.updateConfig(this.config);
	}

	testAuthentication(): Promise<AuthTestResponse> {
		return testAuthentication(this.config);
	}

	unpin(files: string[]): Promise<UnpinResponse[]> {
		return unpinFile(this.config, files);
	}

	listFiles(): FilterFiles {
		return new FilterFiles(this.config);
	}

	updateMetadata(options: PinataMetadataUpdate): Promise<string> {
		return updateMetadata(this.config, options);
	}

	pinJobs(): FilterPinJobs {
		return new FilterPinJobs(this.config);
	}
}

class UploadBuilder<T> {
	private config: PinataConfig | undefined;
	private uploadFunction: (
		config: PinataConfig | undefined,
		...args: any[]
	) => Promise<T>;
	private args: any[];
	private metadata: PinataMetadata | undefined;
	private keys: string | undefined;
	private peerAddresses: string[] | undefined;
	private version: 0 | 1 | undefined;
	private groupId: string | undefined;

	constructor(
		config: PinataConfig | undefined,
		uploadFunction: (
			config: PinataConfig | undefined,
			...args: any[]
		) => Promise<T>,
		...args: any[]
	) {
		this.config = config;
		this.uploadFunction = uploadFunction;
		this.args = args;
		this.version = 1;
	}

	addMetadata(metadata: PinataMetadata): UploadBuilder<T> {
		this.metadata = metadata;
		return this;
	}

	key(jwt: string): UploadBuilder<T> {
		this.keys = jwt;
		return this;
	}

	cidVersion(v: 0 | 1): UploadBuilder<T> {
		this.version = v;
		return this;
	}

	group(groupId: string): UploadBuilder<T> {
		this.groupId = groupId;
		return this;
	}

	peerAddress(peerAddresses: string[]): UploadBuilder<T> {
		this.peerAddresses = peerAddresses;
		return this;
	}

	then<TResult1 = T, TResult2 = never>(
		onfulfilled?:
			| ((value: T) => TResult1 | PromiseLike<TResult1>)
			| null
			| undefined,
		onrejected?:
			| ((reason: any) => TResult2 | PromiseLike<TResult2>)
			| null
			| undefined,
	): Promise<TResult1 | TResult2> {
		const options: UploadOptions = this.args[this.args.length - 1] || {};
		if (this.metadata) {
			options.metadata = this.metadata;
		}
		if (this.keys) {
			options.keys = this.keys;
		}
		if (this.groupId) {
			options.groupId = this.groupId;
		}
		if (this.version) {
			options.cidVersion = this.version;
		}
		if (this.peerAddresses && "peerAddresses" in options) {
			options.peerAddresses = this.peerAddresses;
		}
		this.args[this.args.length - 1] = options;
		return this.uploadFunction(this.config, ...this.args).then(
			onfulfilled,
			onrejected,
		);
	}
}

class Upload {
	config: PinataConfig | undefined;

	constructor(config?: PinataConfig) {
		this.config = formatConfig(config);
	}

	updateConfig(newConfig: PinataConfig): void {
		this.config = newConfig;
	}

	file(file: FileObject, options?: UploadOptions): UploadBuilder<PinResponse> {
		return new UploadBuilder(this.config, uploadFile, file, options);
	}

	fileArray(
		files: FileObject[],
		options?: UploadOptions,
	): UploadBuilder<PinResponse> {
		return new UploadBuilder(this.config, uploadFileArray, files, options);
	}

	base64(
		base64String: string,
		options?: UploadOptions,
	): UploadBuilder<PinResponse> {
		return new UploadBuilder(this.config, uploadBase64, base64String, options);
	}

	url(url: string, options?: UploadOptions): UploadBuilder<PinResponse> {
		return new UploadBuilder(this.config, uploadUrl, url, options);
	}

	json(data: object, options?: UploadOptions): UploadBuilder<PinResponse> {
		return new UploadBuilder(this.config, uploadJson, data, options);
	}

	cid(
		cid: string,
		options?: UploadCIDOptions,
	): UploadBuilder<PinByCIDResponse> {
		return new UploadBuilder(this.config, uploadCid, cid, options);
	}
}

class FilterFiles {
	private config: PinataConfig | undefined;
	private query: PinListQuery = {};
	// rate limit vars
	private requestCount = 0;
	private lastRequestTime = 0;
	private readonly MAX_REQUESTS_PER_MINUTE = 30;
	private readonly MINUTE_IN_MS = 60000;

	constructor(config: PinataConfig | undefined) {
		this.config = config;
	}

	cid(cid: string): FilterFiles {
		this.query.cid = cid;
		return this;
	}

	pinStart(date: string): FilterFiles {
		this.query.pinStart = date;
		return this;
	}

	pinEnd(date: string): FilterFiles {
		this.query.pinEnd = date;
		return this;
	}

	pinSizeMin(size: number): FilterFiles {
		this.query.pinSizeMin = size;
		return this;
	}

	pinSizeMax(size: number): FilterFiles {
		this.query.pinSizeMax = size;
		return this;
	}

	pageLimit(limit: number): FilterFiles {
		this.query.pageLimit = limit;
		return this;
	}

	pageOffset(offset: number): FilterFiles {
		this.query.pageOffset = offset;
		return this;
	}

	name(name: string): FilterFiles {
		this.query.name = name;
		return this;
	}

	group(groupId: string): FilterFiles {
		this.query.groupId = groupId;
		return this;
	}

	keyValue(
		key: string,
		value: string | number,
		operator?: PinListQuery["operator"],
	): FilterFiles {
		this.query.key = key;
		this.query.value = value;
		if (operator) {
			this.query.operator = operator;
		}
		return this;
	}

	then(onfulfilled?: ((value: PinListItem[]) => any) | null): Promise<any> {
		return listFiles(this.config, this.query).then(onfulfilled);
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

	async *[Symbol.asyncIterator](): AsyncGenerator<PinListItem, void, unknown> {
		let hasMore = true;
		let offset = 0;
		const limit = this.query.pageLimit || 10;

		while (hasMore) {
			await this.rateLimit(); // applying rate limit
			this.query.pageOffset = offset;
			this.query.pageLimit = limit;

			const items = await listFiles(this.config, this.query);

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

	async all(): Promise<PinListItem[]> {
		const allItems: PinListItem[] = [];
		for await (const item of this) {
			allItems.push(item);
		}
		return allItems;
	}
}

class Gateways {
	config: PinataConfig | undefined;

	constructor(config?: PinataConfig) {
		this.config = formatConfig(config);
	}

	updateConfig(newConfig: PinataConfig): void {
		this.config = newConfig;
	}

	get(cid: string): Promise<GetCIDResponse> {
		return getCid(this.config, cid);
	}

	convert(url: string): Promise<string> {
		return convertIPFSUrl(this.config, url);
	convert(url: string, gatewayPrefix?: string): Promise<string> {
		return convertIPFSUrl(this.config, url, gatewayPrefix);
	}

	topUsageAnalytics(options: {
		domain: string;
		start: string;
		end: string;
		sortBy: "requests" | "bandwidth";
		attribute:
			| "cid"
			| "country"
			| "region"
			| "user_agent"
			| "referer"
			| "file_name";
	}): TopGatewayAnalyticsBuilder {
		return new TopGatewayAnalyticsBuilder(
			this.config,
			options.domain,
			options.start,
			options.end,
			options.sortBy,
			options.attribute,
		);
	}

	dateIntervalAnalytics(options: {
		domain: string;
		start: string;
		end: string;
		interval: "day" | "week";
	}): TimeIntervalGatewayAnalyticsBuilder {
		return new TimeIntervalGatewayAnalyticsBuilder(
			this.config,
			options.domain,
			options.start,
			options.end,
			options.interval,
		);
	}

	swapCid(options: SwapCidOptions): Promise<SwapCidResponse> {
		return swapCid(this.config, options);
	}

	swapHistory(options: SwapHistoryOptions): Promise<SwapCidResponse[]> {
		return swapHistory(this.config, options);
	}

	deleteSwap(cid: string): Promise<string> {
		return deleteSwap(this.config, cid);
	}
}

class FilterPinJobs {
	private config: PinataConfig | undefined;
	private query: PinJobQuery = {};
	// rate limit vars
	private requestCount = 0;
	private lastRequestTime = 0;
	private readonly MAX_REQUESTS_PER_MINUTE = 30;
	private readonly MINUTE_IN_MS = 60000;

	constructor(config: PinataConfig | undefined) {
		this.config = config;
	}

	cid(cid: string): FilterPinJobs {
		this.query.ipfs_pin_hash = cid;
		return this;
	}

	status(
		status:
			| "prechecking"
			| "retrieving"
			| "expired"
			| "over_free_limit"
			| "over_max_size"
			| "invalid_object"
			| "bad_host_node",
	): FilterPinJobs {
		this.query.status = status;
		return this;
	}

	pageLimit(limit: number): FilterPinJobs {
		this.query.limit = limit;
		return this;
	}

	pageOffset(offset: number): FilterPinJobs {
		this.query.offset = offset;
		return this;
	}

	sort(sort: "ASC" | "DSC"): FilterPinJobs {
		this.query.sort = sort;
		return this;
	}

	then(onfulfilled?: ((value: PinJobItem[]) => any) | null): Promise<any> {
		return pinJobs(this.config, this.query).then(onfulfilled);
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

	async *[Symbol.asyncIterator](): AsyncGenerator<PinJobItem, void, unknown> {
		let hasMore = true;
		let offset = 0;
		const limit = this.query.limit || 10;

		while (hasMore) {
			await this.rateLimit(); // applying rate limit
			this.query.offset = offset;
			this.query.limit = limit;

			const items = await pinJobs(this.config, this.query);

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

	async all(): Promise<PinJobItem[]> {
		const allItems: PinJobItem[] = [];
		for await (const item of this) {
			allItems.push(item);
		}
		return allItems;
	}
}

class Usage {
	config: PinataConfig | undefined;

	constructor(config?: PinataConfig) {
		this.config = formatConfig(config);
	}

	updateConfig(newConfig: PinataConfig): void {
		this.config = newConfig;
	}

	pinnedFileCount(): Promise<number> {
		return pinnedFileCount(this.config);
	}

	totalStorageSize(): Promise<number> {
		return totalStorageUsage(this.config);
	}
}

class Keys {
	config: PinataConfig | undefined;

	constructor(config?: PinataConfig) {
		this.config = formatConfig(config);
	}

	updateConfig(newConfig: PinataConfig): void {
		this.config = newConfig;
	}

	create(options: KeyOptions): Promise<KeyResponse> {
		return createKey(this.config, options);
	}

	list(): FilterKeys {
		return new FilterKeys(this.config);
	}

	revoke(keys: string[]): Promise<RevokeKeyResponse[]> {
		return revokeKeys(this.config, keys);
	}
}

class FilterKeys {
	private config: PinataConfig | undefined;
	private query: KeyListQuery = {};
	// rate limit vars
	private requestCount = 0;
	private lastRequestTime = 0;
	private readonly MAX_REQUESTS_PER_MINUTE = 30;
	private readonly MINUTE_IN_MS = 60000;

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

	then(onfulfilled?: ((value: KeyListItem[]) => any) | null): Promise<any> {
		return listKeys(this.config, this.query).then(onfulfilled);
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

	async *[Symbol.asyncIterator](): AsyncGenerator<KeyListItem, void, unknown> {
		let hasMore = true;
		let offset = 0;

		while (hasMore) {
			await this.rateLimit(); // applying rate limit
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

class Groups {
	config: PinataConfig | undefined;

	constructor(config?: PinataConfig) {
		this.config = formatConfig(config);
	}

	updateConfig(newConfig: PinataConfig): void {
		this.config = newConfig;
	}

	create(options: GroupOptions): Promise<GroupResponseItem> {
		return createGroup(this.config, options);
	}

	list(): FilterGroups {
		return new FilterGroups(this.config);
	}

	get(options: GetGroupOptions): Promise<GroupResponseItem> {
		return getGroup(this.config, options);
	}

	addCids(options: GroupCIDOptions): Promise<string> {
		return addToGroup(this.config, options);
	}

	removeCids(options: GroupCIDOptions): Promise<string> {
		return removeFromGroup(this.config, options);
	}

	update(options: UpdateGroupOptions): Promise<GroupResponseItem> {
		return updateGroup(this.config, options);
	}

	delete(options: GetGroupOptions): Promise<string> {
		return deleteGroup(this.config, options);
	}
}

class FilterGroups {
	private config: PinataConfig | undefined;
	private query: GroupQueryOptions = {};
	// rate limit vars
	private requestCount = 0;
	private lastRequestTime = 0;
	private readonly MAX_REQUESTS_PER_MINUTE = 30;
	private readonly MINUTE_IN_MS = 60000;

	constructor(config: PinataConfig | undefined) {
		this.config = config;
	}

	offset(offset: number): FilterGroups {
		this.query.offset = offset;
		return this;
	}

	name(nameContains: string): FilterGroups {
		this.query.nameContains = nameContains;
		return this;
	}

	limit(limit: number): FilterGroups {
		this.query.limit = limit;
		return this;
	}

	then(
		onfulfilled?: ((value: GroupResponseItem[]) => any) | null,
	): Promise<any> {
		return listGroups(this.config, this.query).then(onfulfilled);
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

	async *[Symbol.asyncIterator](): AsyncGenerator<
		GroupResponseItem,
		void,
		unknown
	> {
		let hasMore = true;
		let offset = 0;

		while (hasMore) {
			await this.rateLimit(); // applying rate limit
			this.query.offset = offset;

			const items = await listGroups(this.config, this.query);

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

	async all(): Promise<GroupResponseItem[]> {
		const allItems: GroupResponseItem[] = [];
		for await (const item of this) {
			allItems.push(item);
		}
		return allItems;
	}
}

class Signatures {
	config: PinataConfig | undefined;

	constructor(config?: PinataConfig) {
		this.config = formatConfig(config);
	}

	updateConfig(newConfig: PinataConfig): void {
		this.config = newConfig;
	}

	add(options: SignatureOptions): Promise<SignatureResponse> {
		return addSignature(this.config, options);
	}

	get(cid: string): Promise<SignatureResponse> {
		return getSignature(this.config, cid);
	}

	delete(cid: string): Promise<string> {
		return removeSignature(this.config, cid);
	}
}

class GatewayAnalyticsBuilder<T extends GatewayAnalyticsQuery, R> {
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

	protected async getAnalytics(): Promise<R> {
		await this.rateLimit();
		throw new Error("getAnalytics method must be implemented in derived class");
	}

	then(onfulfilled?: ((value: R) => any) | null): Promise<any> {
		return this.getAnalytics().then(onfulfilled);
	}
}

class TopGatewayAnalyticsBuilder extends GatewayAnalyticsBuilder<
	TopGatewayAnalyticsQuery,
	TopGatewayAnalyticsItem[]
> {
	constructor(
		config: PinataConfig | undefined,
		domain: string,
		start: string,
		end: string,
		sortBy: "requests" | "bandwidth",
		attribute:
			| "cid"
			| "country"
			| "region"
			| "user_agent"
			| "referer"
			| "file_name",
	) {
		super(config, {
			gateway_domain: domain,
			start_date: start,
			end_date: end,
			sort_by: sortBy,
			attribute: attribute,
		});
	}

	protected async getAnalytics(): Promise<TopGatewayAnalyticsItem[]> {
		return analyticsTopUsage(this.config, this.query);
	}

	async all(): Promise<TopGatewayAnalyticsItem[]> {
		return this.getAnalytics();
	}
}

class TimeIntervalGatewayAnalyticsBuilder extends GatewayAnalyticsBuilder<
	TimeIntervalGatewayAnalyticsQuery,
	TimeIntervalGatewayAnalyticsResponse
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

	protected async getAnalytics(): Promise<TimeIntervalGatewayAnalyticsResponse> {
		return analyticsDateInterval(this.config, this.query);
	}

	async all(): Promise<TimeIntervalGatewayAnalyticsResponse> {
		return this.getAnalytics();
	}
}
