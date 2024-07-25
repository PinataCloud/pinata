export type PinataConfig = {
	pinataJwt: string;
	pinataGateway?: string;
	pinataGatewayKey?: string;
};

export type AuthTestResponse = {
	message: string;
};

export type PinResponse = {
	IpfsHash: string;
	PinSize: number;
	Timestamp: string;
	isDuplicate?: boolean;
};

export type PinByCIDResponse = {
	id: string;
	ipfsHash: string;
	status: "prechecking" | "retrieving";
	name: string;
	updated?: boolean;
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
	keyValues?: Record<string, string | number>;
};

export type PinataMetadataUpdate = {
	cid: string;
	name?: string;
	keyValues?: Record<string, string | number>;
};

export type UploadOptions = {
	metadata?: PinataMetadata;
	pinType?: "async" | "sync" | "cidOnly";
	keys?: string;
	groupId?: string;
	cidVersion?: 0 | 1;
};

export type UploadCIDOptions = {
	metadata?: PinataMetadata;
	peerAddresses?: string[];
	keys?: string;
	groupId?: string;
};

export type UnpinResponse = {
	hash: string;
	status: string;
};

export type PinListItem = {
	id: string;
	ipfs_pin_hash: string;
	size: number;
	user_id: string;
	date_pinned: string;
	date_unpinned: string | null;
	metadata: {
		name: string | null;
		keyvalues: {
			[key: string]: any;
		} | null;
	};
	regions: {
		regionId: string;
		currentReplicationCount: number;
		desiredReplicationCount: number;
	}[];
	mime_type: string;
	number_of_files: number;
};

export type PinListResponse = {
	rows: PinListItem[];
};

export type PinListQuery = {
	cid?: string;
	pinStart?: string;
	pinEnd?: string;
	pinSizeMin?: number;
	pinSizeMax?: number;
	pageLimit?: number;
	pageOffset?: number;
	name?: string;
	groupId?: string;
	key?: string;
	value?: string | number;
	operator?:
		| "gt"
		| "gte"
		| "lt"
		| "lte"
		| "ne"
		| "eq"
		| "between"
		| "notBetween"
		| "like"
		| "notLike"
		| "iLike"
		| "notILike"
		| "regexp"
		| "iRegexp";
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
};

export type UpdateGroupOptions = {
	name: string;
	groupId: string;
};

export type GetGroupOptions = {
	groupId: string;
};

export type GroupResponseItem = {
	id: string;
	user_id: string;
	name: string;
	updatedAt: string;
	createdAt: string;
};

export type GroupQueryOptions = {
	nameContains?: string;
	offset?: number;
	limit?: number;
};

export type GroupCIDOptions = {
	groupId: string;
	cids: string[];
};
