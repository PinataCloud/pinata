import { PinataMetadata } from "./";

export type UploadResponse = {
	id: string;
	name: string;
	cid: string;
	size: number;
	created_at: string;
	number_of_files: number;
	mime_type: string;
	group_id: string | null;
	keyvalues: {
		[key: string]: string;
	};
	vectorized: boolean;
	network: string;
};

export type UploadOptions = {
	metadata?: PinataMetadata;
	//pinType?: "async" | "sync" | "cidOnly";
	keys?: string;
	groupId?: string;
	vectorize?: boolean;
	url?: string;
	peerAddresses?: string[];
};

export type SignedUploadUrlOptions = {
	date?: number;
	expires: number;
	groupId?: string;
	name?: string;
	keyvalues?: Record<string, string>;
	vectorize?: boolean;
};

export type UploadCIDOptions = {
	metadata?: PinataMetadata;
	peerAddresses?: string[];
	keys?: string;
	groupId?: string;
};

export type PinByCIDResponse = {
	id: string;
	cid: string;
	date_queued: string;
	name: string;
	status: string;
	keyvalues: Record<string, any>;
	host_nodes: string[];
	group_id: string;
};
