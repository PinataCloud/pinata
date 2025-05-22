import { useState, useCallback, useRef, useEffect } from "react";
import {
	NetworkError,
	AuthenticationError,
	type UseUploadReturn,
	type UploadResult,
	type ReactUploadOptions,
} from "../types";

const LARGE_FILE_THRESHOLD = 94371840; // ~90MB
const BASE_CHUNK_SIZE = 262144; // 256KB
const DEFAULT_CHUNKS = 20 * 10;

const normalizeChunkSize = (size: number): number => {
	if (size < BASE_CHUNK_SIZE) {
		return BASE_CHUNK_SIZE;
	}
	return Math.floor(size / BASE_CHUNK_SIZE) * BASE_CHUNK_SIZE;
};

export const useUpload = (): UseUploadReturn => {
	const [progress, setProgress] = useState<number>(0);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<Error | null>(null);
	const [uploadResponse, setUploadResponse] = useState<UploadResult | null>(
		null,
	);

	// Refs for pause/resume/cancel
	const uploadUrlRef = useRef<string | null>(null);
	const pausedRef = useRef<boolean>(false);
	const cancelledRef = useRef<boolean>(false);
	const uploadOffsetRef = useRef<number>(0);
	const fileRef = useRef<File | null>(null);
	const headersRef = useRef<Record<string, string>>({});
	const lastResponseHeadersRef = useRef<Headers | null>(null);
	const chunkSizeRef = useRef<number>(BASE_CHUNK_SIZE * DEFAULT_CHUNKS);

	const resetState = useCallback(() => {
		setProgress(0);
		setError(null);
		setUploadResponse(null);
		uploadUrlRef.current = null;
		pausedRef.current = false;
		cancelledRef.current = false;
		uploadOffsetRef.current = 0;
		fileRef.current = null;
	}, []);

	const pause = useCallback(() => {
		pausedRef.current = true;
	}, []);

	const resume = useCallback(() => {
		if (pausedRef.current && uploadUrlRef.current && fileRef.current) {
			pausedRef.current = false;
			continueChunkedUpload();
		}
	}, []);

	const cancel = useCallback(() => {
		cancelledRef.current = true;
		setLoading(false);
	}, []);

	// Handle chunked upload for large files
	const continueChunkedUpload = useCallback(async () => {
		if (!uploadUrlRef.current || !fileRef.current) return;

		try {
			if (cancelledRef.current) {
				resetState();
				return;
			}

			if (pausedRef.current) return;

			const file = fileRef.current;
			const fileSize = file.size;
			const offset = uploadOffsetRef.current;
			const chunkSize = chunkSizeRef.current;

			if (offset >= fileSize) {
				// Upload is complete
				await finalizeUpload();
				return;
			}

			const endOffset = Math.min(offset + chunkSize, fileSize);
			const chunk = file.slice(offset, endOffset);

			// Upload chunk
			const uploadReq = await fetch(uploadUrlRef.current, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/offset+octet-stream",
					"Upload-Offset": offset.toString(),
					...headersRef.current,
				},
				body: chunk,
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
						metadata: { requestUrl: uploadReq.url },
					},
				);
			}

			// Update offset and progress
			const newOffset = endOffset;
			uploadOffsetRef.current = newOffset;
			const newProgress = Math.min((newOffset / fileSize) * 100, 99.9);
			setProgress(newProgress);

			// Continue with next chunk
			continueChunkedUpload();
		} catch (err) {
			if (err instanceof Error) {
				setError(err);
			} else {
				setError(new Error("Unknown error during upload"));
			}
			setLoading(false);
		}
	}, [resetState]);

	// Finalize upload and get response
	const finalizeUpload = useCallback(async () => {
		if (!uploadUrlRef.current || !fileRef.current) return;

		try {
			// Try to get CID from response headers
			let cid = null;
			if (lastResponseHeadersRef.current) {
				cid = lastResponseHeadersRef.current.get("upload-cid");
			}

			// If no CID in headers, we may need to fetch file info from the API
			// This would depend on your API's response format

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

	// Direct upload for smaller files
	const simpleUpload = async (
		file: File,
		network: "public" | "private",
		url: string,
		options?: ReactUploadOptions,
	) => {
		try {
			const formData = new FormData();
			formData.append("file", file, file.name);
			formData.append("network", network);
			formData.append("name", options?.metadata?.name || file.name);

			if (options?.groupId) {
				formData.append("group_id", options.groupId);
			}

			if (options?.metadata?.keyvalues) {
				formData.append(
					"keyvalues",
					JSON.stringify(options.metadata.keyvalues),
				);
			}

			if (options?.streamable) {
				formData.append("streamable", "true");
			}

			const request = await fetch(url, {
				method: "POST",
				headers: headersRef.current,
				body: formData,
			});

			if (!request.ok) {
				const errorData = await request.text();
				if (request.status === 401 || request.status === 403) {
					throw new AuthenticationError(
						`Authentication failed: ${errorData}`,
						request.status,
						{
							error: errorData,
							code: "AUTH_ERROR",
							metadata: { requestUrl: request.url },
						},
					);
				}
				throw new NetworkError(`HTTP error: ${errorData}`, request.status, {
					error: errorData,
					code: "HTTP_ERROR",
					metadata: { requestUrl: request.url },
				});
			}

			const res = await request.json();
			setUploadResponse(res.data);
			setProgress(100);
			setLoading(false);
		} catch (err) {
			if (err instanceof Error) {
				setError(err);
			} else {
				setError(new Error("Unknown error during upload"));
			}
			setLoading(false);
		}
	};

	// Main upload function
	const upload = useCallback(
		async (
			file: File,
			network: "public" | "private",
			url: string,
			options?: ReactUploadOptions,
		) => {
			try {
				resetState();
				setLoading(true);
				fileRef.current = file;

				// Set up headers
				const headers: Record<string, string> = { Source: "sdk/react" };
				headersRef.current = headers;

				if (options?.chunkSize && options.chunkSize > 0) {
					chunkSizeRef.current = normalizeChunkSize(options.chunkSize);
				} else {
					chunkSizeRef.current = BASE_CHUNK_SIZE * DEFAULT_CHUNKS;
				}

				// For smaller files, use simple upload
				if (file.size <= LARGE_FILE_THRESHOLD) {
					await simpleUpload(file, network, url, options);
					return;
				}

				// For larger files, use chunked upload with TUS protocol
				let metadata = `filename ${btoa(file.name)},filetype ${btoa(file.type)},network ${btoa(network)}`;

				if (options?.groupId) {
					metadata += `,group_id ${btoa(options.groupId)}`;
				}

				if (options?.metadata?.keyvalues) {
					metadata += `,keyvalues ${btoa(JSON.stringify(options.metadata.keyvalues))}`;
				}

				if (options?.streamable) {
					metadata += `,streamable ${btoa("true")}`;
				}

				// Initialize TUS upload
				const urlReq = await fetch(url, {
					method: "POST",
					headers: {
						"Upload-Length": `${file.size}`,
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

				// Start chunked upload
				continueChunkedUpload();
			} catch (err) {
				if (err instanceof Error) {
					setError(err);
				} else {
					setError(new Error("Unknown error during upload initialization"));
				}
				setLoading(false);
			}
		},
		[resetState, continueChunkedUpload],
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
