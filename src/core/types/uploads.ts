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
	 * Resumable uploads (files over 90 MiB) only. Defaults to true: wait until the server
	 * has registered the file, then return it. With false, return once the bytes are
	 * stored: the response holds only `size`, `network` and the CID the server sent with
	 * the last chunk (empty if none), and registration can still fail. Not allowed with
	 * `vectorize`.
	 */
	waitForCid?: boolean;
};

/** A file of a folder upload and its path in the folder, e.g. `photos/2024/a.jpg`. */
export type FolderEntry = {
	path: string;
	file: File;
};

/** What happened to one file of a folder upload. */
export type FolderUploadEvent = {
	/**
	 * `start`: the file's bytes start to be sent (again on each attempt).
	 * `complete`: the file is registered in the folder.
	 * `retry`: an attempt failed and the file will be sent again after `delayMs`.
	 * `error`: the file failed for good; the upload goes on with the other files.
	 */
	type: "start" | "complete" | "retry" | "error";
	/** The file's path in the folder, folder name included */
	path: string;
	size: number;
	/** 1 for the first attempt; 0 for a file refused before it was sent */
	attempt: number;
	/** `complete`: the file's own CID */
	cid?: string;
	/** `retry` and `error`: why the attempt failed */
	error?: Error;
	/** `retry`: how long until the next attempt */
	delayMs?: number;
	/** Files registered so far */
	completed: number;
	/** Files that failed for good so far */
	failed: number;
	total: number;
};

export type FolderUploadOptions = UploadOptions & {
	/** How many files send their bytes at the same time. Defaults to 4. */
	concurrency?: number;
	/** How many times a file is sent again after a transient failure. Defaults to 3. */
	retries?: number;
	/** Called for every file event, in order for each file. What it throws is ignored. */
	onProgress?: (event: FolderUploadEvent) => void;
	/**
	 * The folder to upload into (a UUID). Defaults to a new one. Pass the `folderId` of a
	 * FolderUploadError with its failed files to send them again into the same folder; a
	 * file with a path already in the folder replaces it.
	 */
	folderId?: string;
	/**
	 * Cancels the upload: requests under way are aborted and files not uploaded yet fail with
	 * an error named "AbortError". The files already uploaded stay in the folder, and the
	 * upload rejects with a FolderUploadError.
	 */
	signal?: AbortSignal;
};

/** A file of an uploaded folder */
export type FolderFileResult = {
	path: string;
	size: number;
	cid: string;
};

/** The uploaded folder (its CID covers every file) and its files */
export type FolderUploadResponse = UploadResponse & {
	files: FolderFileResult[];
	/**
	 * The same content was already uploaded: the server kept that folder and removed this
	 * one. `id`, `name`, `cid` and the files' paths are that folder's; `group_id` and
	 * `keyvalues` are the ones requested, which it may not have.
	 */
	is_duplicate?: boolean;
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
