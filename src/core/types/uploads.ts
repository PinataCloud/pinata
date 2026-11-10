import { PinataMetadata } from "./";

export type CidVersion = "v0" | "v1";

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
	streamable?: boolean;
	peerAddresses?: string[];
	car?: boolean;
	/**
	 * CID version "v1" or "v0" (defaults to v1 if falsy)
	 */
	cid_version?: CidVersion;
	/**
	 * Unix timestamp (in seconds) when the file should expire (must be in the future)
	 */
	expires_at?: number;
	/**
	 * Resumable uploads (files over 90 MiB) only. Defaults to true: once the server has
	 * every byte, wait until it registers the file and has its CID, then return the
	 * registered file. Set to false to return as soon as the bytes are stored: when the
	 * server registers the file later, the response holds only `name`, `size` and the
	 * `cid` the server returned with the last chunk (empty if it returned none), and
	 * registration can still fail. `false` cannot be combined with `vectorize`, which
	 * needs the registered file.
	 */
	waitForCid?: boolean;
};

export type SignedUploadUrlOptions = {
	date?: number;
	expires: number;
	groupId?: string;
	name?: string;
	keyvalues?: Record<string, string>;
	vectorize?: boolean;
	maxFileSize?: number;
	/**
	 * Restrict the signed URL to specific MIME types.
	 *
	 * NOTE: For directory uploads (e.g. `pinata.upload.public.fileArray(...).url(...)`),
	 * this array MUST include the synthetic `"directory"` MIME type — otherwise the
	 * upload will be rejected with `400 "Presigned URL does not grant permissions to
	 * upload detected MIME type: directory"`. Aliases like `application/x-directory` or
	 * `inode/directory` are NOT accepted, and a wildcard (`["*"]` / `["*\/*"]`) does not
	 * cover it.
	 *
	 * Example: `mimeTypes: ["directory"]` (or `["directory", "text/plain"]` to also
	 * allow plain-text files inside the directory).
	 */
	mimeTypes?: string[];
	/**
	 * Mint this signed URL for directory uploads (e.g. `fileArray(...).url(...)`).
	 *
	 * Adds `"directory"` to `mimeTypes` so the API permits the synthetic directory
	 * MIME type. Any other entries in `mimeTypes` are preserved, so you can both
	 * allow a directory and constrain the file types inside it.
	 */
	forDirectory?: boolean;
	streamable?: boolean;
	car?: boolean;
	/**
	 * CID version "v1" or "v0" (defaults to v1 if falsy)
	 */
	cid_version?: CidVersion;
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
	keyvalues: Record<string, any> | null;
	host_nodes: string[] | null;
	group_id: string | null;
};
