import type {
	UploadResponse as PinataUploadResponse,
	UploadOptions,
} from "../../core";
// Import error types directly from pinata
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../utils";

export type UploadResult = PinataUploadResponse | string;

export interface ReactUploadOptions extends UploadOptions {
	chunkSize?: number; // Size in bytes for each upload chunk
}

export type UseUploadReturn = {
	progress: number;
	loading: boolean;
	error: Error | null;
	uploadResponse: UploadResult | null;
	upload: (
		file: File,
		network: "public" | "private",
		url: string,
		options?: UploadOptions,
	) => Promise<void>;
	pause: () => void;
	resume: () => void;
	cancel: () => void;
};

// Re-export error types from pinata for convenience
export { PinataError, NetworkError, AuthenticationError, ValidationError };
