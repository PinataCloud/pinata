import { useState, useCallback, useRef, useEffect } from "react";
import * as FileSystem from "expo-file-system";
import {
	NetworkError,
	AuthenticationError,
	ValidationError,
	type UploadOptions,
	type UseUploadReturn,
} from "../types";
//@ts-ignore
import Base64 from "Base64";

const BASE_CHUNK_SIZE = 50 * 1024 * 1024 + 1;

export const useUpload = (): UseUploadReturn => {
	const [progress, setProgress] = useState<number>(0);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<Error | null>(null);
	const [uploadResponse, setUploadResponse] = useState<string | null>(null);

	// Refs to manage pause/resume/cancel functionality
	const uploadUrlRef = useRef<string | null>(null);
	const pausedRef = useRef<boolean>(false);
	const cancelledRef = useRef<boolean>(false);
	const uploadOffsetRef = useRef<number>(0);
	const fileInfoRef = useRef<{
		fileUri: string;
		fileSize: number;
		fileType: string;
		fileName: string;
	} | null>(null);
	const optionsRef = useRef<UploadOptions | null>(null);
	const networkRef = useRef<"public" | "private">("public");
	const headerRef = useRef<Record<string, string>>({});
	const lastResponseHeadersRef = useRef<Headers | null>(null);
	const chunkSizeRef = useRef<number>(BASE_CHUNK_SIZE);

	// Reset state for new upload
	const resetState = useCallback(() => {
		setProgress(0);
		setError(null);
		setUploadResponse(null);
		uploadUrlRef.current = null;
		pausedRef.current = false;
		cancelledRef.current = false;
		uploadOffsetRef.current = 0;
		fileInfoRef.current = null;
	}, []);

	// Pause upload
	const pause = useCallback(() => {
		pausedRef.current = true;
	}, []);

	// Resume upload
	const resume = useCallback(() => {
		if (pausedRef.current && uploadUrlRef.current && fileInfoRef.current) {
			pausedRef.current = false;
			continueUpload();
		}
	}, []);

	// Cancel upload
	const cancel = useCallback(() => {
		cancelledRef.current = true;
		setLoading(false);
	}, []);

	// Continue upload from current offset
	const continueUpload = useCallback(async () => {
		if (!uploadUrlRef.current || !fileInfoRef.current) {
			return;
		}

		try {
			if (cancelledRef.current) {
				resetState();
				return;
			}

			if (pausedRef.current) {
				return;
			}

			const { fileUri, fileSize } = fileInfoRef.current;
			const chunkSize = chunkSizeRef.current;
			const offset = uploadOffsetRef.current;

			if (offset >= fileSize) {
				// Upload is complete, fetch the file info
				await finalizeUpload();
				return;
			}

			const endOffset = Math.min(offset + chunkSize, fileSize);
			const chunkLength = endOffset - offset;

			// Read chunk from file
			const chunk = await FileSystem.readAsStringAsync(fileUri, {
				encoding: FileSystem.EncodingType.Base64,
				position: offset,
				length: chunkLength,
			});

			// Convert base64 to binary for upload
			const binaryString = Base64.atob(chunk);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}

			// Upload chunk
			const uploadReq = await fetch(uploadUrlRef.current, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/offset+octet-stream",
					"Upload-Offset": offset.toString(),
					...headerRef.current,
				},
				body: bytes,
			});

			lastResponseHeadersRef.current = uploadReq.headers;

			if (!uploadReq.ok) {
				const errorData = await uploadReq.text();
				throw new NetworkError(
					`HTTP error during chunk upload: ${errorData}`,
					uploadReq.status,
					{
						error: errorData,
						code: "HTTP_ERROR",
						metadata: {
							requestUrl: uploadReq.url,
						},
					},
				);
			}

			// Update offset and progress
			const newOffset = offset + chunkLength;
			uploadOffsetRef.current = newOffset;
			const newProgress = Math.min((newOffset / fileSize) * 100, 99.9);
			setProgress(newProgress);

			// Continue with next chunk
			continueUpload();
		} catch (err) {
			if (err instanceof Error) {
				setError(err);
			} else {
				setError(new Error("Unknown error during upload"));
			}
			setLoading(false);
		}
	}, [resetState]);

	// Finalize the upload and fetch file info
	const finalizeUpload = useCallback(async () => {
		if (!uploadUrlRef.current || !fileInfoRef.current) {
			return;
		}
		try {
			let cid: string | null = "";

			// Try to get the CID from the headers of the last response
			if (lastResponseHeadersRef.current) {
				const uploadCid = lastResponseHeadersRef.current.get("upload-cid");
				if (uploadCid) {
					cid = uploadCid;
				} else {
					cid = null;
				}
			}

			setUploadResponse(cid);
			setProgress(100);
			setLoading(false);
		} catch (err) {
			if (err instanceof Error) {
				setError(err);
			} else {
				setError(new Error("Unknown error during upload finalization"));
			}
			setLoading(false);
		}
	}, []);

	// Main upload function
	const upload = useCallback(
		async (
			fileUri: string,
			network: "public" | "private",
			url: string,
			options?: UploadOptions,
		) => {
			try {
				resetState();
				setLoading(true);

				// Store references for pause/resume functionality
				optionsRef.current = options || null;
				networkRef.current = network;

				if (options?.chunkSize && options.chunkSize > 0) {
					chunkSizeRef.current = options.chunkSize;
				} else {
					chunkSizeRef.current = BASE_CHUNK_SIZE;
				}

				// Get file info from Expo FileSystem
				const fileInfo = await FileSystem.getInfoAsync(fileUri);
				if (!fileInfo.exists) {
					throw new ValidationError(`File does not exist at path: ${fileUri}`);
				}

				// Basic MIME type mapping
				const mimeTypes: Record<string, string> = {
					jpg: "image/jpeg",
					jpeg: "image/jpeg",
					png: "image/png",
					gif: "image/gif",
					pdf: "application/pdf",
					json: "application/json",
					txt: "text/plain",
					mp4: "video/mp4",
					mov: "video/mov",
					mp3: "audio/mpeg",
				};

				// Determine file type from URI extension
				const extension = (fileUri.split(".").pop()?.toLowerCase() ||
					"") as string;

				let fileType = "application/octet-stream";

				if (extension && extension in mimeTypes) {
					fileType = mimeTypes[extension] as string;
				}

				// Get filename from URI
				const fileName =
					options?.name || fileUri.split("/").pop() || "File from SDK";

				fileInfoRef.current = {
					fileUri,
					fileSize: fileInfo.size,
					fileType,
					fileName,
				};

				// Set headers
				let headers: Record<string, string>;
				if (
					options?.customHeaders &&
					Object.keys(options?.customHeaders).length > 0
				) {
					headers = {
						...options.customHeaders,
					};
				} else {
					headers = {
						Source: "sdk/expo",
					};
				}

				headerRef.current = headers;

				// Prepare metadata for TUS upload
				let metadata = `filename ${Base64.btoa(fileName)},filetype ${Base64.btoa(fileType)},network ${Base64.btoa(network)}`;

				if (options?.groupId) {
					metadata += `,group_id ${Base64.btoa(options.groupId)}`;
				}

				if (options?.keyvalues) {
					metadata += `,keyvalues ${Base64.btoa(JSON.stringify(options.keyvalues))}`;
				}

				// Initialize upload with TUS
				const urlReq = await fetch(url, {
					method: "POST",
					headers: {
						"Upload-Length": `${fileInfo.size}`,
						"Upload-Metadata": metadata,
						...headers,
					},
				});

				if (!urlReq.ok) {
					const errorData = await urlReq.text();
					if (urlReq.status === 401 || urlReq.status === 403) {
						throw new AuthenticationError(
							`Authentication failed: ${errorData}`,
							urlReq.status,
							{
								error: errorData,
								code: "AUTH_ERROR",
							},
						);
					}
					throw new NetworkError("Error initializing upload", urlReq.status, {
						error: errorData,
						code: "HTTP_ERROR",
					});
				}

				const uploadUrl = urlReq.headers.get("Location");
				if (!uploadUrl) {
					throw new NetworkError("Upload URL not provided", urlReq.status, {
						error: "No location header found",
						code: "HTTP_ERROR",
					});
				}

				uploadUrlRef.current = uploadUrl;

				// Start the upload process
				continueUpload();
			} catch (err) {
				if (err instanceof Error) {
					setError(err);
				} else {
					setError(new Error("Unknown error during upload initialization"));
				}
				setLoading(false);
			}
		},
		[resetState, continueUpload],
	);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			cancelledRef.current = true;
		};
	}, []);

	return {
		progress,
		loading,
		error,
		uploadResponse,
		upload,
		pause,
		resume,
		cancel,
	};
};
