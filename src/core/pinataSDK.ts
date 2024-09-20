import type {
	FileObject,
	FileListItem,
	FileListQuery,
	UploadResponse,
	PinataConfig,
	PinataMetadata,
	UpdateFileOptions,
	UploadOptions,
	GetCIDResponse,
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
	DeleteResponse,
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
	ContainsCIDResponse,
	OptimizeImageOptions,
	GroupListResponse,
	SignedUrlOptions,
	FileListResponse,
} from "./types";
import { testAuthentication } from "./authentication/testAuthentication";
import { uploadFile } from "./uploads/file";
import { uploadFileArray } from "./uploads/fileArray";
import { uploadBase64 } from "./uploads/base64";
import { uploadUrl } from "./uploads/url";
import { uploadJson } from "./uploads/json";
import { deleteFile } from "./files/delete";
import { listFiles } from "./files/list";
import { updateFile } from "./files/updateFile";
import { getCid } from "./gateway/getCid";
import { convertIPFSUrl } from "./gateway/convertIPFSUrl";
// import { pinnedFileCount } from "./files/pinnedFileUsage";
// import { totalStorageUsage } from "./files/totalStorageUsage";
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
// import { addSignature } from "./signatures/addSignature";
// import { getSignature } from "./signatures/getSignature";
// import { removeSignature } from "./signatures/removeSignature";
import { analyticsTopUsage } from "./gateway/analyticsTopUsage";
import { analyticsDateInterval } from "./gateway/analyticsDateInterval";
import { swapCid } from "./files/swapCid";
import { swapHistory } from "./files/swapHistory";
import { deleteSwap } from "./files/deleteSwap";
import { containsCID } from "../utils/gateway-tools";
import { createSignedURL } from "./gateway/createSignedURL";

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
	files: Files;
	upload: Upload;
	gateways: Gateways;
	//	usage: Usage;
	keys: Keys;
	groups: Groups;
	//signatures: Signatures;

	constructor(config?: PinataConfig) {
		this.config = formatConfig(config);
		this.files = new Files(this.config);
		this.upload = new Upload(this.config);
		this.gateways = new Gateways(this.config);
		//		this.usage = new Usage(this.config);
		this.keys = new Keys(this.config);
		this.groups = new Groups(this.config);
		//		this.signatures = new Signatures(this.config);
	}

	setNewHeaders(headers: Record<string, string>): void {
		if (!this.config) {
			this.config = { pinataJwt: "", customHeaders: {} };
		}
		this.config.customHeaders = { ...this.config.customHeaders, ...headers };

		// Update headers for all sub-modules
		this.files.updateConfig(this.config);
		this.upload.updateConfig(this.config);
		this.gateways.updateConfig(this.config);
		//		this.usage.updateConfig(this.config);
		this.keys.updateConfig(this.config);
		this.groups.updateConfig(this.config);
		//		this.signatures.updateConfig(this.config);
	}

	testAuthentication(): Promise<AuthTestResponse> {
		return testAuthentication(this.config);
	}
}

class Files {
	config: PinataConfig | undefined;

	constructor(config?: PinataConfig) {
		this.config = formatConfig(config);
	}

	updateConfig(newConfig: PinataConfig): void {
		this.config = newConfig;
	}

	list(): FilterFiles {
		return new FilterFiles(this.config);
	}

	delete(files: string[]): Promise<DeleteResponse[]> {
		return deleteFile(this.config, files);
	}

	update(options: UpdateFileOptions): Promise<FileListItem> {
		return updateFile(this.config, options);
	}

	addSwap(options: SwapCidOptions): Promise<SwapCidResponse> {
		return swapCid(this.config, options);
	}

	getSwapHistory(options: SwapHistoryOptions): Promise<SwapCidResponse[]> {
		return swapHistory(this.config, options);
	}

	deleteSwap(cid: string): Promise<string> {
		return deleteSwap(this.config, cid);
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
	}

	addMetadata(metadata: PinataMetadata): UploadBuilder<T> {
		this.metadata = metadata;
		return this;
	}

	key(jwt: string): UploadBuilder<T> {
		this.keys = jwt;
		return this;
	}

	// cidVersion(v: 0 | 1): UploadBuilder<T> {
	// 	this.version = v;
	// 	return this;
	// }

	group(groupId: string): UploadBuilder<T> {
		this.groupId = groupId;
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

	file(
		file: FileObject,
		options?: UploadOptions,
	): UploadBuilder<UploadResponse> {
		return new UploadBuilder(this.config, uploadFile, file, options);
	}

	// fileArray(
	// 	files: FileObject[],
	// 	options?: UploadOptions,
	// ): UploadBuilder<UploadResponse> {
	// 	return new UploadBuilder(this.config, uploadFileArray, files, options);
	// }

	base64(
		base64String: string,
		options?: UploadOptions,
	): UploadBuilder<UploadResponse> {
		return new UploadBuilder(this.config, uploadBase64, base64String, options);
	}

	url(url: string, options?: UploadOptions): UploadBuilder<UploadResponse> {
		return new UploadBuilder(this.config, uploadUrl, url, options);
	}

	json(data: object, options?: UploadOptions): UploadBuilder<UploadResponse> {
		return new UploadBuilder(this.config, uploadJson, data, options);
	}
}

class FilterFiles {
	private config: PinataConfig | undefined;
	private query: FileListQuery = {};
	private currentPageToken: string | undefined;
	// rate limit vars
	// private requestCount = 0;
	// private lastRequestTime = 0;
	// private readonly MAX_REQUESTS_PER_MINUTE = 30;
	// private readonly MINUTE_IN_MS = 60000;

	constructor(config: PinataConfig | undefined) {
		this.config = config;
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

	pageToken(pageToken: string): FilterFiles {
		this.query.pageToken = pageToken;
		return this;
	}

	then(onfulfilled?: ((value: FileListResponse) => any) | null): Promise<any> {
		return this.fetchPage().then(onfulfilled);
	}

	private async fetchPage(): Promise<FileListResponse> {
		if (this.currentPageToken) {
			this.query.pageToken = this.currentPageToken;
		}
		const response = await listFiles(this.config, this.query);
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

class Gateways {
	config: PinataConfig | undefined;

	constructor(config?: PinataConfig) {
		this.config = formatConfig(config);
	}

	updateConfig(newConfig: PinataConfig): void {
		this.config = newConfig;
	}

	get(cid: string): OptimizeImageGetCid {
		return new OptimizeImageGetCid(this.config, cid);
	}

	createSignedURL(options: SignedUrlOptions): OptimizeImageCreateSignedURL {
		return new OptimizeImageCreateSignedURL(this.config, options);
	}

	// topUsageAnalytics(options: {
	// 	domain: string;
	// 	start: string;
	// 	end: string;
	// 	sortBy: "requests" | "bandwidth";
	// 	attribute:
	// 		| "cid"
	// 		| "country"
	// 		| "region"
	// 		| "user_agent"
	// 		| "referer"
	// 		| "file_name";
	// }): TopGatewayAnalyticsBuilder {
	// 	return new TopGatewayAnalyticsBuilder(
	// 		this.config,
	// 		options.domain,
	// 		options.start,
	// 		options.end,
	// 		options.sortBy,
	// 		options.attribute,
	// 	);
	// }

	// dateIntervalAnalytics(options: {
	// 	domain: string;
	// 	start: string;
	// 	end: string;
	// 	interval: "day" | "week";
	// }): TimeIntervalGatewayAnalyticsBuilder {
	// 	return new TimeIntervalGatewayAnalyticsBuilder(
	// 		this.config,
	// 		options.domain,
	// 		options.start,
	// 		options.end,
	// 		options.interval,
	// 	);
	// }
}

class OptimizeImageGetCid {
	private config: PinataConfig | undefined;
	private cid: string;
	private options: OptimizeImageOptions = {};

	constructor(config: PinataConfig | undefined, cid: string) {
		this.config = config;
		this.cid = cid;
	}

	optimizeImage(options: OptimizeImageOptions): OptimizeImageGetCid {
		this.options = { ...this.options, ...options };
		return this;
	}

	then(onfulfilled?: ((value: GetCIDResponse) => any) | null): Promise<any> {
		return getCid(this.config, this.cid, this.options).then(onfulfilled);
	}
}

class OptimizeImageCreateSignedURL {
	private config: PinataConfig | undefined;
	private urlOpts: SignedUrlOptions;
	private imgOpts: OptimizeImageOptions = {};

	constructor(config: PinataConfig | undefined, urlOpts: SignedUrlOptions) {
		this.config = config;
		this.urlOpts = urlOpts;
	}

	optimizeImage(options: OptimizeImageOptions): OptimizeImageCreateSignedURL {
		this.imgOpts = { ...this.imgOpts, ...options };
		return this;
	}

	then(onfulfilled?: ((value: string) => any) | null): Promise<any> {
		return createSignedURL(this.config, this.urlOpts, this.imgOpts).then(
			onfulfilled,
		);
	}
}

// class Usage {
// 	config: PinataConfig | undefined;

// 	constructor(config?: PinataConfig) {
// 		this.config = formatConfig(config);
// 	}

// 	updateConfig(newConfig: PinataConfig): void {
// 		this.config = newConfig;
// 	}

// 	pinnedFileCount(): Promise<number> {
// 		return pinnedFileCount(this.config);
// 	}

// 	totalStorageSize(): Promise<number> {
// 		return totalStorageUsage(this.config);
// 	}
// }

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

	then(onfulfilled?: ((value: KeyListItem[]) => any) | null): Promise<any> {
		return listKeys(this.config, this.query).then(onfulfilled);
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

	// addFiles(options: GroupCIDOptions): Promise<string> {
	// 	return addToGroup(this.config, options);
	// }

	// removeFiles(options: GroupCIDOptions): Promise<string> {
	// 	return removeFromGroup(this.config, options);
	// }

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
	// private requestCount = 0;
	// private lastRequestTime = 0;
	// private readonly MAX_REQUESTS_PER_MINUTE = 30;
	// private readonly MINUTE_IN_MS = 60000;
	private nextPageToken: string | undefined;

	constructor(config: PinataConfig | undefined) {
		this.config = config;
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
		return listGroups(this.config, this.query);
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

// class Signatures {
// 	config: PinataConfig | undefined;

// 	constructor(config?: PinataConfig) {
// 		this.config = formatConfig(config);
// 	}

// 	updateConfig(newConfig: PinataConfig): void {
// 		this.config = newConfig;
// 	}

// 	add(options: SignatureOptions): Promise<SignatureResponse> {
// 		return addSignature(this.config, options);
// 	}

// 	get(cid: string): Promise<SignatureResponse> {
// 		return getSignature(this.config, cid);
// 	}

// 	delete(cid: string): Promise<string> {
// 		return removeSignature(this.config, cid);
// 	}
// }

// class GatewayAnalyticsBuilder<T extends GatewayAnalyticsQuery, R> {
// 	protected config: PinataConfig | undefined;
// 	protected query: T;
// 	private requestCount = 0;
// 	private lastRequestTime = 0;
// 	private readonly MAX_REQUESTS_PER_MINUTE = 30;
// 	private readonly MINUTE_IN_MS = 60000;

// 	constructor(config: PinataConfig | undefined, query: T) {
// 		this.config = config;
// 		this.query = query;
// 	}

// 	cid(cid: string): this {
// 		this.query.cid = cid;
// 		return this;
// 	}

// 	fileName(fileName: string): this {
// 		this.query.file_name = fileName;
// 		return this;
// 	}

// 	userAgent(userAgent: string): this {
// 		this.query.user_agent = userAgent;
// 		return this;
// 	}

// 	country(country: string): this {
// 		this.query.country = country;
// 		return this;
// 	}

// 	region(region: string): this {
// 		this.query.region = region;
// 		return this;
// 	}

// 	referer(referer: string): this {
// 		this.query.referer = referer;
// 		return this;
// 	}

// 	limit(limit: number): this {
// 		this.query.limit = limit;
// 		return this;
// 	}

// 	sort(order: "asc" | "desc"): this {
// 		this.query.sort_order = order;
// 		return this;
// 	}

// 	private async rateLimit(): Promise<void> {
// 		this.requestCount++;
// 		const now = Date.now();
// 		if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
// 			const timePassedSinceLastRequest = now - this.lastRequestTime;
// 			if (timePassedSinceLastRequest < this.MINUTE_IN_MS) {
// 				const delayTime = this.MINUTE_IN_MS - timePassedSinceLastRequest;
// 				await new Promise((resolve) => setTimeout(resolve, delayTime));
// 			}
// 			this.requestCount = 0;
// 		}
// 		this.lastRequestTime = Date.now();
// 	}

// 	protected async getAnalytics(): Promise<R> {
// 		await this.rateLimit();
// 		throw new Error("getAnalytics method must be implemented in derived class");
// 	}

// 	then(onfulfilled?: ((value: R) => any) | null): Promise<any> {
// 		return this.getAnalytics().then(onfulfilled);
// 	}
// }

// class TopGatewayAnalyticsBuilder extends GatewayAnalyticsBuilder<
// 	TopGatewayAnalyticsQuery,
// 	TopGatewayAnalyticsItem[]
// > {
// 	constructor(
// 		config: PinataConfig | undefined,
// 		domain: string,
// 		start: string,
// 		end: string,
// 		sortBy: "requests" | "bandwidth",
// 		attribute:
// 			| "cid"
// 			| "country"
// 			| "region"
// 			| "user_agent"
// 			| "referer"
// 			| "file_name",
// 	) {
// 		super(config, {
// 			gateway_domain: domain,
// 			start_date: start,
// 			end_date: end,
// 			sort_by: sortBy,
// 			attribute: attribute,
// 		});
// 	}

// 	protected async getAnalytics(): Promise<TopGatewayAnalyticsItem[]> {
// 		return analyticsTopUsage(this.config, this.query);
// 	}

// 	async all(): Promise<TopGatewayAnalyticsItem[]> {
// 		return this.getAnalytics();
// 	}
// }

// class TimeIntervalGatewayAnalyticsBuilder extends GatewayAnalyticsBuilder<
// 	TimeIntervalGatewayAnalyticsQuery,
// 	TimeIntervalGatewayAnalyticsResponse
// > {
// 	constructor(
// 		config: PinataConfig | undefined,
// 		domain: string,
// 		start: string,
// 		end: string,
// 		dateInterval: "day" | "week",
// 	) {
// 		super(config, {
// 			gateway_domain: domain,
// 			start_date: start,
// 			end_date: end,
// 			date_interval: dateInterval,
// 		});
// 	}

// 	sortBy(sortBy: "requests" | "bandwidth"): this {
// 		this.query.sort_by = sortBy;
// 		return this;
// 	}

// 	protected async getAnalytics(): Promise<TimeIntervalGatewayAnalyticsResponse> {
// 		return analyticsDateInterval(this.config, this.query);
// 	}

// 	async all(): Promise<TimeIntervalGatewayAnalyticsResponse> {
// 		return this.getAnalytics();
// 	}
// }
