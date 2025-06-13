export type UploadOptions = {
	customHeaders?: Record<string, string>;
	name?: string;
	keyvalues?: Record<string, string>;
	groupId?: string;
	chunkSize?: number;
};

export type UploadResponse = {
	id: string;
};

export type UseUploadReturn = {
	progress: number;
	loading: boolean;
	error: Error | null;
	uploadResponse: string | null;
	upload: (
		fileUri: string,
		network: "public" | "private",
		url: string,
		options?: UploadOptions,
	) => Promise<void>;
	pause: () => void;
	resume: () => void;
	cancel: () => void;
};

export class PinataError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PinataError";
	}
}

export class NetworkError extends PinataError {
	status: number;
	details: any;

	constructor(message: string, status: number, details?: any) {
		super(message);
		this.name = "NetworkError";
		this.status = status;
		this.details = details;
	}
}

export class AuthenticationError extends PinataError {
	status: number;
	details: any;

	constructor(message: string, status: number, details?: any) {
		super(message);
		this.name = "AuthenticationError";
		this.status = status;
		this.details = details;
	}
}

export class ValidationError extends PinataError {
	constructor(message: string) {
		super(message);
		this.name = "ValidationError";
	}
}
