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

export type PinQueueQuery = {
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
	pageToken?: string;
};

export type PinQueueItem = {
	id: string;
	cid?: string;
	ipfs_pin_hash?: string;
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

export type PinQueueResponse = {
	rows: PinQueueItem[];
	next_page_token: string;
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

export type VectorizeFileResponse = {
	status: boolean;
};

export type VectorizeQuery = {
	groupId: string;
	query: string;
	returnFile?: boolean;
};

export type VectorQueryMatch = {
	file_id: string;
	cid: string;
	score: number;
};

export type VectorizeQueryResponse = {
	count: number;
	matches: VectorQueryMatch[];
};
