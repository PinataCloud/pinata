import type { FolderFileResult } from "../core/types";

interface ErrorDetails {
	error?: string;
	code?: string;
	metadata?: Record<string, any>;
}

export class PinataError extends Error {
	constructor(
		message: string,
		public statusCode?: number,
		public details?: ErrorDetails,
	) {
		super(message);
		this.name = "PinataError";
	}
}

export class NetworkError extends PinataError {
	constructor(message: string, statusCode?: number, details?: ErrorDetails) {
		super(message, statusCode, details);
		this.name = "NetworkError";
	}
}

export class AuthenticationError extends PinataError {
	constructor(message: string, statusCode?: number, details?: ErrorDetails) {
		super(message, statusCode, details);
		this.name = "AuthenticationError";
	}
}

export class ValidationError extends PinataError {
	constructor(message: string, details?: ErrorDetails) {
		super(message, undefined, details);
		this.name = "ValidationError";
	}
}

/**
 * A folder upload in which some files failed for good, after their retries. `uploaded` are
 * in the folder `folderId`; the server finishes that folder's CID on its own, without the
 * failed files. `index` is a file's position in the files given. `folder` is that folder as
 * the server finished it, when it could be asked (not after a cancel or an authentication
 * failure): with `is_duplicate`, its content matched an earlier folder, which `id`, `name`
 * and `cid` are, and `folderId` was removed. `folderName` is the folder's name as this
 * upload resolved it (the name given, else the top directory all paths share, else the
 * default); every path starts with it.
 *
 * To send the failed files again into the same folder, pass each one with its full path,
 * `{ path: failed[i].path, file: files[failed[i].index] }`, and `{ folderId }`: the paths
 * keep the folder name. Sending the original relative paths again with `.name(folderName)`
 * only works when they don't all share a top directory of their own, which `.name()`
 * would rename. Not when `folder.is_duplicate`: `folderId` was removed, and the files sent
 * into it would make a folder of their own, without the uploaded ones. Send every file
 * again, uploaded and failed, without `folderId`. Without `folder` (the folder could not be
 * finished), send the failed files within 30 minutes: a folder left without new files for
 * longer may be replaced by an earlier one of the same content as well.
 */
export class FolderUploadError extends PinataError {
	constructor(
		message: string,
		public folderId: string,
		public uploaded: FolderFileResult[],
		public failed: {
			index: number;
			path: string;
			size: number;
			error: Error;
		}[],
		public folder?: {
			id: string;
			name: string;
			cid: string;
			is_duplicate?: boolean;
		},
		public folderName?: string,
	) {
		super(message, undefined, { code: "FOLDER_UPLOAD_ERROR" });
		this.name = "FolderUploadError";
	}
}
