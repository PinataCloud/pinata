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
 * failed files.
 */
export class FolderUploadError extends PinataError {
	constructor(
		message: string,
		public folderId: string,
		public uploaded: { path: string; size: number; cid: string }[],
		public failed: { path: string; size: number; error: Error }[],
	) {
		super(message, undefined, { code: "FOLDER_UPLOAD_ERROR" });
		this.name = "FolderUploadError";
	}
}
