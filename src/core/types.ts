export type PinataConfig = {
	pinataJwt?: string;
	pinataGateway?: string;
	pinataGatewayKey?: string;
	customHeaders?: Record<string, string>;
	endpointUrl?: string;
	uploadUrl?: string;
};

export type AuthTestResponse = {
	message: string;
};

export type UploadResponse = {
	id: string;
	name: string;
	cid: string;
	size: number;
	created_at: string;
	number_of_files: number;
	mime_type: string;
	user_id: string;
	group_id: string | null;
};

export type FileObject = {
	name: string;
	size: number;
	type: string;
	lastModified: number;
	arrayBuffer: () => Promise<ArrayBuffer>;
};

export type JsonBody = Record<string, unknown>;

export type PinataMetadata = {
	name?: string;
	keyvalues?: Record<string, string>;
};

export type UpdateFileOptions = {
	id: string;
	name?: string;
	keyvalues?: Record<string, string>;
};

export type UploadOptions = {
	metadata?: PinataMetadata;
	//pinType?: "async" | "sync" | "cidOnly";
	keys?: string;
	groupId?: string;
	vectorize?: boolean;
};

export type DeleteResponse = {
	id: string;
	status: string;
};

export type FileListItem = {
	id: string;
	name: string | null;
	cid: "pending" | string;
	size: number;
	number_of_files: number;
	mime_type: string;
	keyvalues: Record<string, string>;
	group_id: string | null;
	created_at: string;
};

export type FileListResponse = {
	files: FileListItem[];
	next_page_token: string;
};

export type FileListQuery = {
	name?: string;
	group?: string;
	noGroup?: boolean;
	mimeType?: string;
	cid?: string;
	cidPending?: boolean;
	metadata?: Record<string, string>;
	order?: "ASC" | "DESC";
	limit?: number;
	pageToken?: string;
};

export type PinJobQuery = {
	sort?: "ASC" | "DSC";
	status?:
		| "prechecking"
		| "retrieving"
		| "expired"
		| "over_free_limit"
		| "over_max_size"
		| "invalid_object"
		| "bad_host_node";
	ipfs_pin_hash?: string;
	limit?: number;
	offset?: number;
};

export type PinJobItem = {
	id: string;
	ipfs_pin_hash: string;
	date_queued: string;
	name: string;
	status: string;
	keyvalues: any;
	host_nodes: string[];
	pin_policy: {
		regions: {
			id: string;
			desiredReplicationCount: number;
		}[];
		version: number;
	};
};

export type PinJobResponse = {
	rows: PinJobItem[];
};

export type ContentType =
	| "application/json"
	| "application/xml"
	| "text/plain"
	| "text/html"
	| "text/css"
	| "text/javascript"
	| "application/javascript"
	| "image/jpeg"
	| "image/png"
	| "image/gif"
	| "image/svg+xml"
	| "audio/mpeg"
	| "audio/ogg"
	| "video/mp4"
	| "application/pdf"
	| "application/octet-stream"
	| string
	| null; // Allow for other MIME types

export type GetCIDResponse = {
	data?: JSON | string | Blob | null;
	contentType: ContentType;
};

export type OptimizeImageOptions = {
	width?: number;
	height?: number;
	dpr?: number;
	fit?: "scaleDown" | "contain" | "cover" | "crop" | "pad";
	gravity?: "auto" | "side" | string;
	quality?: number;
	format?: "auto" | "webp";
	animation?: boolean;
	sharpen?: number;
	onError?: boolean;
	metadata?: "keep" | "copyright" | "none";
};

export type SignedUrlOptions = {
	cid: string;
	date?: number;
	expires: number;
	gateway?: string;
};

export type AnalyticsQuery = {
	gateway_domain: string;
	start_date: string;
	end_date: string;
	cid?: string;
	file_name?: string;
	user_agent?: string;
	country?: string;
	region?: string;
	referer?: string;
	limit?: number;
	sort_order?: "asc" | "desc";
};

export type TopAnalyticsQuery = AnalyticsQuery & {
	sort_by: "requests" | "bandwidth";
	attribute:
		| "cid"
		| "country"
		| "region"
		| "user_agent"
		| "referer"
		| "file_name";
};

export type TopAnalyticsResponse = {
	data: TopAnalyticsItem[];
};

export type TopAnalyticsItem = {
	value: string;
	requests: number;
	bandwidth: number;
};

export type TimeIntervalAnalyticsQuery = AnalyticsQuery & {
	sort_by?: "requests" | "bandwidth";
	date_interval: "day" | "week";
};

export type TimePeriodItem = {
	period_start_time: string;
	requests: number;
	bandwidth: number;
};

export type TimeIntervalAnalyticsResponse = {
	total_requests: number;
	total_bandwidth: number;
	time_periods: TimePeriodItem[];
};

export type UserPinnedDataResponse = {
	pin_count: number;
	pin_size_total: number;
	pin_size_with_replications_total: number;
};

export type KeyPermissions = {
	admin?: boolean;
	endpoints?: Endpoints;
};

export type Endpoints = {
	data?: DataEndponts;
	pinning?: PinningEndpoints;
};

export type DataEndponts = {
	pinList?: boolean;
	userPinnedDataTotal?: boolean;
};

export type PinningEndpoints = {
	hashMetadata?: boolean;
	hashPinPolicy?: boolean;
	pinByHash?: boolean;
	pinFileToIPFS?: boolean;
	pinJSONToIPFS?: boolean;
	pinJobs?: boolean;
	unpin?: boolean;
	userPinPolicy?: boolean;
};

export type KeyOptions = {
	keyName: string;
	permissions: KeyPermissions;
	maxUses?: number;
};

export type KeyResponse = {
	JWT: string;
	pinata_api_key: string;
	pinata_api_secret: string;
};

export type KeyListQuery = {
	revoked?: boolean;
	limitedUse?: boolean;
	exhausted?: boolean;
	name?: string;
	offset?: number;
};

export type KeyListItem = {
	id: string;
	name: string;
	key: string;
	secret: string;
	max_uses: number;
	uses: number;
	user_id: string;
	scopes: KeyScopes;
	revoked: boolean;
	createdAt: string;
	updatedAt: string;
};

type KeyScopes = {
	endpoints: {
		pinning: {
			pinFileToIPFS: boolean;
			pinJSONToIPFS: boolean;
		};
	};
	admin: boolean;
};

export type KeyListResponse = {
	keys: KeyListItem[];
	count: number;
};

export type RevokeKeyResponse = {
	key: string;
	status: string;
};

export type GroupOptions = {
	name: string;
	isPublic?: boolean;
};

export type UpdateGroupOptions = {
	groupId: string;
	name?: string;
	isPublic?: boolean;
};

export type GetGroupOptions = {
	groupId: string;
};

export type GroupListResponse = {
	groups: GroupResponseItem[];
	next_page_token: string;
};

export type GroupResponseItem = {
	id: string;
	is_public: boolean;
	name: string;
	createdAt: string;
};

export type GroupQueryOptions = {
	name?: string;
	limit?: number;
	pageToken?: string;
	isPublic?: boolean;
};

export type GroupCIDOptions = {
	groupId: string;
	files: string[];
};

export type UpdateGroupFilesResponse = {
	id: string;
	status: string;
};

export type SignatureOptions = {
	cid: string;
	signature: string;
};

export type SignatureResponse = {
	cid: string;
	signature: string;
};

export type SwapCidOptions = {
	cid: string;
	swapCid: string;
};

export type SwapHistoryOptions = {
	cid: string;
	domain: string;
};

export type SwapCidResponse = {
	mapped_cid: string;
	created_at: string;
};

export type ContainsCIDResponse = {
	containsCid: boolean;
	cid: string | null;
};

export type VectorizeFileResponse = {
	status: boolean;
};
