import { uploadFile } from "../../src/core/functions";
import type {
	PinataConfig,
	UploadOptions,
	UploadResponse,
	PinataMetadata,
	CidVersion,
} from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";
import { NodeLikeFile, byteAt } from "./nodeLikeFile";

describe("uploadFile function", () => {
	let originalFetch: typeof fetch;

	beforeEach(() => {
		originalFetch = global.fetch;
	});

	afterEach(() => {
		global.fetch = originalFetch;
		jest.clearAllMocks();
	});

	const mockConfig: PinataConfig = {
		pinataJwt: "test-jwt",
		pinataGateway: "https://test.mypinata.cloud",
	};

	const mockFile = new File(["test content"], "test.txt", {
		type: "text/plain",
	});

	const mockResponse: UploadResponse = {
		id: "testId",
		name: "test.txt",
		cid: "QmTest123",
		size: 123,
		created_at: "2023-01-01T00:00:00Z",
		number_of_files: 1,
		mime_type: "text/plain",
		group_id: null,
		keyvalues: {
			env: "dev",
		},
		vectorized: false,
		network: "private",
	};

	it("should upload file to public network successfully", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		const result = await uploadFile(mockConfig, mockFile, "public");

		expect(result).toEqual(mockResponse);
		expect(global.fetch).toHaveBeenCalledWith(
			"https://uploads.pinata.cloud/v3/files",
			expect.objectContaining({
				method: "POST",
				headers: {
					Source: "sdk/file",
					Authorization: "Bearer test-jwt",
				},
				body: expect.any(FormData),
			}),
		);
	});

	it("vectorizes a file up to 90 MiB even with waitForCid: false, which only applies to larger files", async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
			})
			.mockResolvedValueOnce({ ok: true });

		const result = await uploadFile(mockConfig, mockFile, "public", {
			waitForCid: false,
			vectorize: true,
		});

		expect(result).toMatchObject({ cid: mockResponse.cid, vectorized: true });
		expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain(
			`/vectorize/files/${mockResponse.id}`,
		);
	});

	it("should handle upload options for private network", async () => {
		const mockMetadata: PinataMetadata = {
			name: "Custom File Name",
			keyvalues: {
				key1: "value1",
			},
		};
		const mockOptions: UploadOptions = {
			metadata: mockMetadata,
			groupId: "test-group",
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		await uploadFile(mockConfig, mockFile, "private", mockOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://uploads.pinata.cloud/v3/files",
			expect.objectContaining({
				method: "POST",
				headers: {
					Source: "sdk/file",
					Authorization: "Bearer test-jwt",
				},
				body: expect.any(FormData),
			}),
		);

		const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
		const formData = fetchCall[1].body as FormData;

		expect(formData.get("name")).toBe("Custom File Name");
		expect(formData.get("group_id")).toBe("test-group");
		expect(formData.get("keyvalues")).toBe(JSON.stringify({ key1: "value1" }));
		expect(formData.get("network")).toBe("private");
	});

	it("should use custom JWT if provided in options for public network", async () => {
		const customJwt = "custom-jwt";
		const mockOptions: UploadOptions = {
			keys: customJwt,
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		await uploadFile(mockConfig, mockFile, "public", mockOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://uploads.pinata.cloud/v3/files",
			expect.objectContaining({
				headers: {
					Source: "sdk/file",
					Authorization: `Bearer ${customJwt}`,
				},
			}),
		);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(uploadFile(undefined, mockFile, "public")).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			text: jest.fn().mockResolvedValueOnce("Unauthorized"),
		});

		await expect(uploadFile(mockConfig, mockFile, "private")).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			text: jest.fn().mockResolvedValueOnce("Server Error"),
		});

		await expect(uploadFile(mockConfig, mockFile, "public")).rejects.toThrow(
			NetworkError,
		);
	});

	it("should throw PinataError on fetch failure", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValueOnce(new Error("Network failure"));

		await expect(uploadFile(mockConfig, mockFile, "private")).rejects.toThrow(
			PinataError,
		);
	});

	it("should upload file with CAR format enabled", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		const mockOptions: UploadOptions = {
			car: true,
		};

		await uploadFile(mockConfig, mockFile, "public", mockOptions);

		const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
		const formData = fetchCall[1].body as FormData;

		expect(formData.get("car")).toBe("true");
		expect(global.fetch).toHaveBeenCalledWith(
			"https://uploads.pinata.cloud/v3/files",
			expect.objectContaining({
				method: "POST",
				headers: {
					Source: "sdk/file",
					Authorization: "Bearer test-jwt",
				},
				body: expect.any(FormData),
			}),
		);
	});

	it("should upload file with CID version 0", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		const mockOptions: UploadOptions = {
			cid_version: "v0" as CidVersion,
		};

		await uploadFile(mockConfig, mockFile, "public", mockOptions);

		const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
		const formData = fetchCall[1].body as FormData;

		expect(formData.get("cid_version")).toBe("v0");
		expect(global.fetch).toHaveBeenCalledWith(
			"https://uploads.pinata.cloud/v3/files",
			expect.objectContaining({
				method: "POST",
				headers: {
					Source: "sdk/file",
					Authorization: "Bearer test-jwt",
				},
				body: expect.any(FormData),
			}),
		);
	});

	it("should upload file with CID version 1", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		const mockOptions: UploadOptions = {
			cid_version: "v1" as CidVersion,
		};

		await uploadFile(mockConfig, mockFile, "public", mockOptions);

		const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
		const formData = fetchCall[1].body as FormData;

		expect(formData.get("cid_version")).toBe("v1");
		expect(global.fetch).toHaveBeenCalledWith(
			"https://uploads.pinata.cloud/v3/files",
			expect.objectContaining({
				method: "POST",
				headers: {
					Source: "sdk/file",
					Authorization: "Bearer test-jwt",
				},
				body: expect.any(FormData),
			}),
		);
	});

	it("should upload same file with both CID versions", async () => {
		const testFile = new File(["test content for cid versions"], "test.txt", {
			type: "text/plain",
		});

		// Mock for CID version 0
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({
					data: { ...mockResponse, cid: "QmTestVersion0" },
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({
					data: {
						...mockResponse,
						cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
					},
				}),
			});

		// Upload with CID version 0
		const result0 = await uploadFile(mockConfig, testFile, "public", {
			cid_version: "v0" as CidVersion,
		});

		// Upload with CID version 1
		const result1 = await uploadFile(mockConfig, testFile, "public", {
			cid_version: "v1" as CidVersion,
		});

		// Verify both uploads
		expect(result0.cid).toBe("QmTestVersion0");
		expect(result1.cid).toBe(
			"bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
		);

		// Verify fetch was called twice
		expect(global.fetch).toHaveBeenCalledTimes(2);

		// Check CID version 0 FormData
		const fetchCall0 = (global.fetch as jest.Mock).mock.calls[0];
		const formData0 = fetchCall0[1].body as FormData;
		expect(formData0.get("cid_version")).toBe("v0");

		// Check CID version 1 FormData
		const fetchCall1 = (global.fetch as jest.Mock).mock.calls[1];
		const formData1 = fetchCall1[1].body as FormData;
		expect(formData1.get("cid_version")).toBe("v1");
	});

	it("should upload file with CID version combined with other options", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		const mockOptions: UploadOptions = {
			cid_version: "v1" as CidVersion,
			car: true,
			groupId: "test-group",
			streamable: true,
		};

		await uploadFile(mockConfig, mockFile, "public", mockOptions);

		const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
		const formData = fetchCall[1].body as FormData;

		expect(formData.get("cid_version")).toBe("v1");
		expect(formData.get("car")).toBe("true");
		expect(formData.get("group_id")).toBe("test-group");
		expect(formData.get("streamable")).toBe("true");
	});

	it("should upload file with expires_at timestamp", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		const futureTimestamp = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
		const mockOptions: UploadOptions = {
			expires_at: futureTimestamp,
		};

		await uploadFile(mockConfig, mockFile, "public", mockOptions);

		const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
		const formData = fetchCall[1].body as FormData;

		expect(formData.get("expires_at")).toBe(futureTimestamp.toString());
		expect(global.fetch).toHaveBeenCalledWith(
			"https://uploads.pinata.cloud/v3/files",
			expect.objectContaining({
				method: "POST",
				headers: {
					Source: "sdk/file",
					Authorization: "Bearer test-jwt",
				},
				body: expect.any(FormData),
			}),
		);
	});

	it("should upload file with expires_at combined with other options", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		const futureTimestamp = Math.floor(Date.now() / 1000) + 86400;
		const mockOptions: UploadOptions = {
			expires_at: futureTimestamp,
			groupId: "test-group",
			metadata: {
				name: "Test File",
				keyvalues: { key: "value" },
			},
		};

		await uploadFile(mockConfig, mockFile, "private", mockOptions);

		const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
		const formData = fetchCall[1].body as FormData;

		expect(formData.get("expires_at")).toBe(futureTimestamp.toString());
		expect(formData.get("group_id")).toBe("test-group");
		expect(formData.get("name")).toBe("Test File");
		expect(formData.get("keyvalues")).toBe(JSON.stringify({ key: "value" }));
	});

	it("should include CID version in metadata for large file upload", async () => {
		// Create a large file (over 90MB) to trigger chunked upload metadata path
		const largeFileSize = 94371841; // Just over the threshold
		const largeFile = new File(
			[new ArrayBuffer(largeFileSize)],
			"large-test.txt",
			{
				type: "text/plain",
			},
		);

		// Mock the first call (initial upload request) to verify metadata
		global.fetch = jest.fn().mockImplementationOnce(() => {
			// We're just testing that the request is made with correct metadata
			// Return a promise that we can inspect the call and then reject to avoid complex mocking
			return Promise.reject(new Error("Test stopped after metadata check"));
		});

		const mockOptions: UploadOptions = {
			cid_version: "v1" as CidVersion,
		};

		try {
			await uploadFile(mockConfig, largeFile, "private", mockOptions);
		} catch (error) {
			// Expected to fail, we just want to check the metadata
		}

		// Check that the initial request contains cid_version in Upload-Metadata
		expect(global.fetch).toHaveBeenCalledTimes(1);
		const initialCall = (global.fetch as jest.Mock).mock.calls[0];
		const uploadMetadata = initialCall[1].headers["Upload-Metadata"];

		// The metadata should contain base64 encoded cid_version
		expect(uploadMetadata).toContain("cid_version");
		expect(uploadMetadata).toContain(btoa("v1"));
	});

	it("should include expires_at in metadata for large file upload", async () => {
		// Create a large file (over 90MB) to trigger chunked upload metadata path
		const largeFileSize = 94371841; // Just over the threshold
		const largeFile = new File(
			[new ArrayBuffer(largeFileSize)],
			"large-test.txt",
			{
				type: "text/plain",
			},
		);

		// Mock the first call (initial upload request) to verify metadata
		global.fetch = jest.fn().mockImplementationOnce(() => {
			return Promise.reject(new Error("Test stopped after metadata check"));
		});

		const futureTimestamp = Math.floor(Date.now() / 1000) + 86400;
		const mockOptions: UploadOptions = {
			expires_at: futureTimestamp,
		};

		try {
			await uploadFile(mockConfig, largeFile, "private", mockOptions);
		} catch (error) {
			// Expected to fail, we just want to check the metadata
		}

		// Check that the initial request contains expires_at in Upload-Metadata
		expect(global.fetch).toHaveBeenCalledTimes(1);
		const initialCall = (global.fetch as jest.Mock).mock.calls[0];
		const uploadMetadata = initialCall[1].headers["Upload-Metadata"];

		// The metadata should contain base64 encoded expires_at
		expect(uploadMetadata).toContain("expires_at");
		expect(uploadMetadata).toContain(btoa(futureTimestamp.toString()));
	});

	describe("chunked upload recovery", () => {
		// Just over the 90 MiB threshold, so the file goes through TUS in two chunks
		const largeSize = 94371841;
		const chunkSize = 50 * 1024 * 1024 + 1;
		const uploadUrl = "https://uploads.pinata.cloud/v3/files/file-id/large.bin";
		let largeFile: File;
		let setTimeoutSpy: jest.SpyInstance;

		beforeAll(() => {
			largeFile = new File([new ArrayBuffer(largeSize)], "large.bin", {
				type: "application/octet-stream",
			});
		});

		// The same bytes as a file held in memory (a File built from a Buffer) and as a file
		// on disk (fs.openAsBlob), whose size can be too small (see NodeLikeFile)
		let content: Uint8Array<ArrayBuffer>;
		beforeAll(() => {
			content = new Uint8Array(largeSize);
			for (let i = 0; i < content.length; i++) {
				content[i] = byteAt(i);
			}
		});
		const inMemory = () =>
			new File([content], "large.bin", { type: "application/octet-stream" });
		const onDisk = (actual = largeSize, reported = largeSize) =>
			NodeLikeFile.of({ length: actual, reported, disk: true });
		const kinds: Array<[string, () => File]> = [
			["held in memory", inMemory],
			[
				"in parts held in memory",
				() =>
					NodeLikeFile.of(
						{ length: 40 * 1024 * 1024 },
						{ length: largeSize - 40 * 1024 * 1024 },
					),
			],
			["on disk", () => onDisk()],
		];

		beforeEach(() => {
			// Skip the retry backoff
			setTimeoutSpy = jest.spyOn(global, "setTimeout").mockImplementation(((
				callback: () => void,
			) => {
				callback();
				return 0;
			}) as unknown as typeof setTimeout);
		});

		afterEach(() => {
			setTimeoutSpy.mockRestore();
		});

		const created = () =>
			new Response(null, { status: 201, headers: { Location: uploadUrl } });
		const accepted = (offset: number, cid?: string) =>
			new Response(null, {
				status: 204,
				headers: {
					"Upload-Offset": offset.toString(),
					...(cid ? { "Upload-Cid": cid } : {}),
				},
			});
		const uploadStatus = (offset: number, cid?: string) =>
			new Response(null, {
				status: 200,
				headers: {
					"Upload-Offset": offset.toString(),
					"Upload-Length": largeSize.toString(),
					...(cid ? { "Upload-Cid": cid } : {}),
				},
			});
		const fileInfo = () =>
			new Response(JSON.stringify({ data: { files: [mockResponse] } }), {
				status: 200,
			});

		// Answers each request with the next step and records what was sent
		const script = (...steps: Array<Response | Error>) => {
			const calls: {
				method: string;
				url: string;
				offset?: string;
				size?: number;
				// First and last byte of the PATCH body
				first?: number;
				last?: number;
				length?: string;
			}[] = [];
			global.fetch = jest.fn(async (url: any, init?: any) => {
				const body: Blob | Uint8Array | undefined = init?.body;
				const byte = async (at: number) =>
					body instanceof Blob
						? new Uint8Array(await body.slice(at, at + 1).arrayBuffer())[0]
						: body?.[at];
				const size = body instanceof Blob ? body.size : body?.byteLength;
				calls.push({
					method: init?.method ?? "GET",
					url: url.toString(),
					offset: init?.headers?.["Upload-Offset"],
					size,
					first: size ? await byte(0) : undefined,
					last: size ? await byte(size - 1) : undefined,
					length: init?.headers?.["Upload-Length"],
				});
				const step = steps.shift();
				if (!step) {
					throw new Error("unexpected request");
				}
				if (step instanceof Error) {
					throw step;
				}
				return step;
			}) as jest.Mock;
			return calls;
		};

		it("finishes with the CID from HEAD when the last chunk's response is lost", async () => {
			const calls = script(
				created(),
				accepted(chunkSize),
				new Error("socket hang up"),
				uploadStatus(largeSize, "bafyfinal"),
				fileInfo(),
			);

			const result = await uploadFile(mockConfig, largeFile, "public");

			expect(result).toEqual(mockResponse);
			expect(calls.map((c) => c.method)).toEqual([
				"POST",
				"PATCH",
				"PATCH",
				"HEAD",
				"GET",
			]);
			expect(calls[3].url).toBe(uploadUrl);
			expect(calls[4].url).toContain("cid=bafyfinal");
		});

		it.each(kinds)(
			"resends the rest of the chunk from the offset the server reports after a failed PATCH (file %s)",
			async (_kind, file) => {
				const stored = 10 * 1024 * 1024 + 7;
				const calls = script(
					created(),
					new Error("connection reset"),
					uploadStatus(stored),
					accepted(chunkSize),
					accepted(largeSize, "bafyfinal"),
					fileInfo(),
				);

				await uploadFile(mockConfig, file(), "public");

				const patches = calls.filter((c) => c.method === "PATCH");
				expect(patches.map((c) => c.offset)).toEqual([
					"0",
					stored.toString(),
					chunkSize.toString(),
				]);
				expect(patches.map((c) => c.size)).toEqual([
					chunkSize,
					chunkSize - stored,
					largeSize - chunkSize,
				]);
				// Each body holds the file's bytes at its offset
				expect(patches.map((c) => [c.first, c.last])).toEqual([
					[byteAt(0), byteAt(chunkSize - 1)],
					[byteAt(stored), byteAt(chunkSize - 1)],
					[byteAt(chunkSize), byteAt(largeSize - 1)],
				]);
			},
		);

		it("resends the chunk when the server stored nothing and answered 503", async () => {
			const calls = script(
				created(),
				accepted(chunkSize),
				new Response("body ended early", { status: 503 }),
				uploadStatus(chunkSize),
				accepted(largeSize, "bafyfinal"),
				fileInfo(),
			);

			await uploadFile(mockConfig, largeFile, "public");

			const patches = calls.filter((c) => c.method === "PATCH");
			expect(patches.map((c) => c.offset)).toEqual([
				"0",
				chunkSize.toString(),
				chunkSize.toString(),
			]);
		});

		it("follows the Upload-Offset of a 204 that stored only part of the chunk", async () => {
			const calls = script(
				created(),
				accepted(1000),
				accepted(chunkSize),
				accepted(largeSize, "bafyfinal"),
				fileInfo(),
			);

			await uploadFile(mockConfig, largeFile, "public");

			const patches = calls.filter((c) => c.method === "PATCH");
			expect(patches.map((c) => c.offset)).toEqual([
				"0",
				"1000",
				chunkSize.toString(),
			]);
			expect(patches.map((c) => c.size)).toEqual([
				chunkSize,
				chunkSize - 1000,
				largeSize - chunkSize,
			]);
		});

		it.each(kinds)(
			"skips ahead when the server reports an offset past the chunk it was sent (file %s)",
			async (_kind, file) => {
				const calls = script(
					created(),
					accepted(chunkSize + 1000),
					accepted(largeSize, "bafyfinal"),
					fileInfo(),
				);

				await uploadFile(mockConfig, file(), "public");

				const patches = calls.filter((c) => c.method === "PATCH");
				expect(patches.map((c) => c.offset)).toEqual([
					"0",
					(chunkSize + 1000).toString(),
				]);
				expect(patches[1]).toMatchObject({
					size: largeSize - chunkSize - 1000,
					first: byteAt(chunkSize + 1000),
				});
			},
		);

		it.each(kinds)(
			"rereads the file from the start when the server reports an offset before the current chunk (file %s)",
			async (_kind, file) => {
				const calls = script(
					created(),
					accepted(chunkSize),
					new Error("socket hang up"),
					uploadStatus(500),
					accepted(500 + chunkSize),
					accepted(largeSize, "bafyfinal"),
					fileInfo(),
				);

				await uploadFile(mockConfig, file(), "public");

				const patches = calls.filter((c) => c.method === "PATCH");
				expect(patches.map((c) => c.offset)).toEqual([
					"0",
					chunkSize.toString(),
					"500",
					(500 + chunkSize).toString(),
				]);
				expect(patches[2]).toMatchObject({
					size: chunkSize,
					first: byteAt(500),
					last: byteAt(500 + chunkSize - 1),
				});
				expect(patches[3]).toMatchObject({
					size: largeSize - 500 - chunkSize,
					first: byteAt(500 + chunkSize),
					last: byteAt(largeSize - 1),
				});
			},
		);

		it("retries at its own offset when HEAD cannot answer", async () => {
			const calls = script(
				created(),
				new Error("socket hang up"),
				new Response(null, { status: 503 }),
				accepted(chunkSize),
				accepted(largeSize, "bafyfinal"),
				fileInfo(),
			);

			await uploadFile(mockConfig, largeFile, "public");

			const patches = calls.filter((c) => c.method === "PATCH");
			expect(patches.map((c) => c.offset)).toEqual([
				"0",
				"0",
				chunkSize.toString(),
			]);
		});

		it("throws when the server has every byte but returns no CID", async () => {
			const calls = script(
				created(),
				accepted(chunkSize),
				new Error("socket hang up"),
				uploadStatus(largeSize),
			);

			await expect(uploadFile(mockConfig, largeFile, "public")).rejects.toThrow(
				"did not return its CID",
			);
			expect(calls.map((c) => c.method)).toEqual([
				"POST",
				"PATCH",
				"PATCH",
				"HEAD",
			]);
		});

		it("throws when the upload no longer exists", async () => {
			const calls = script(
				created(),
				new Error("socket hang up"),
				new Response(null, { status: 404 }),
			);

			await expect(uploadFile(mockConfig, largeFile, "public")).rejects.toThrow(
				NetworkError,
			);
			expect(calls.map((c) => c.method)).toEqual(["POST", "PATCH", "HEAD"]);
		});

		it("gives up after 5 retries", async () => {
			const steps: Response[] = [created()];
			for (let i = 0; i < 5; i++) {
				steps.push(new Response("boom", { status: 500 }), uploadStatus(0));
			}
			steps.push(new Response("boom", { status: 500 }));
			const calls = script(...steps);

			await expect(uploadFile(mockConfig, largeFile, "public")).rejects.toThrow(
				"after 5 retries",
			);
			expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(6);
			expect(calls.filter((c) => c.method === "HEAD")).toHaveLength(5);
		});

		it("resets the retry budget when HEAD shows the server stored more", async () => {
			// Every PATCH response is lost, but the server stores 1000 more bytes each time
			const steps: Response[] = [created()];
			for (let i = 1; i <= 6; i++) {
				steps.push(
					new Response("lost", { status: 502 }),
					uploadStatus(i * 1000),
				);
			}
			steps.push(accepted(largeSize, "bafyfinal"), fileInfo());
			const calls = script(...steps);

			await uploadFile(mockConfig, largeFile, "public");

			const patches = calls.filter((c) => c.method === "PATCH");
			expect(patches.map((c) => c.offset)).toEqual(
				[0, 1000, 2000, 3000, 4000, 5000, 6000].map(String),
			);
			// The backoff starts over too
			expect(setTimeoutSpy.mock.calls.map((c) => c[1])).toEqual(
				Array(6).fill(1000),
			);
		});

		describe("on a server that registers the file after its last byte", () => {
			// The last PATCH answers before the file is registered
			const received = (cid?: string) =>
				new Response(null, {
					status: 204,
					headers: {
						"Upload-Offset": largeSize.toString(),
						"Upload-Status": "processing",
						...(cid ? { "Upload-Cid": cid } : {}),
					},
				});
			const head = (status: string, cid?: string, error?: string) =>
				new Response(null, {
					status: 200,
					headers: {
						"Upload-Offset": largeSize.toString(),
						"Upload-Status": status,
						...(cid ? { "Upload-Cid": cid } : {}),
						...(error ? { "Upload-Error": error } : {}),
					},
				});

			it("looks the file up only once HEAD reports it ready", async () => {
				const calls = script(
					created(),
					accepted(chunkSize),
					received("bafyfinal"),
					head("processing"),
					head("ready", "bafyfinal"),
					fileInfo(),
				);

				const result = await uploadFile(mockConfig, largeFile, "public");

				expect(result).toEqual(mockResponse);
				expect(calls.map((c) => c.method)).toEqual([
					"POST",
					"PATCH",
					"PATCH",
					"HEAD",
					"HEAD",
					"GET",
				]);
				expect(calls[5].url).toContain("cid=bafyfinal");
				// The server routes only clients that prefer async completion to that path
				expect(
					(global.fetch as jest.Mock).mock.calls[0][1].headers.Prefer,
				).toBe("respond-async");
			});

			it("waits for the CID when the last PATCH returns none", async () => {
				const calls = script(
					created(),
					accepted(chunkSize),
					received(),
					head("ready", "bafyfinal"),
					fileInfo(),
				);

				await uploadFile(mockConfig, largeFile, "public");

				expect(calls[4].url).toContain("cid=bafyfinal");
			});

			it("throws when the upload fails after its last byte", async () => {
				const calls = script(
					created(),
					accepted(chunkSize),
					received("bafyfinal"),
					head("failed", undefined, "stored copy differs"),
				);

				await expect(
					uploadFile(mockConfig, largeFile, "public"),
				).rejects.toThrow("not registered: stored copy differs");
				expect(calls.some((c) => c.method === "GET")).toBe(false);
			});

			it("throws without a reason when the server gives none", async () => {
				script(
					created(),
					accepted(chunkSize),
					received("bafyfinal"),
					head("failed"),
				);

				const error = await uploadFile(mockConfig, largeFile, "public").catch(
					(e) => e,
				);
				expect(error).toBeInstanceOf(NetworkError);
				expect(error.message).toBe(
					"The upload was received but not registered",
				);
				expect(error.statusCode).toBe(422);
			});

			it("gives up when the upload is never registered, and says how to keep polling", async () => {
				// Every Date.now() is 5 minutes later; the deadline is 15 minutes for <1 GiB
				let now = 0;
				const clock = jest.spyOn(Date, "now").mockImplementation(() => {
					now += 5 * 60 * 1000;
					return now;
				});
				try {
					const calls = script(
						created(),
						accepted(chunkSize),
						received("bafyfinal"),
						head("processing"),
						head("processing"),
						head("processing"),
					);

					const error = await uploadFile(mockConfig, largeFile, "public").catch(
						(e) => e,
					);
					expect(error).toBeInstanceOf(NetworkError);
					expect(error.message).toContain(
						"Timed out waiting for the upload to be registered after 15 minutes",
					);
					// The caller can finish the job: the upload URL and what to ask it
					expect(error.message).toContain("still processing");
					expect(error.message).toContain(`poll ${uploadUrl} with HEAD`);
					expect(error.message).toContain("Upload-Status: ready");
					// The server may not say why an upload failed: no header is promised
					expect(error.message).not.toContain("Upload-Error");
					expect(error.statusCode).toBe(0);
					expect(error.details.metadata.requestUrl).toBe(uploadUrl);
					expect(calls.some((c) => c.method === "GET")).toBe(false);
				} finally {
					clock.mockRestore();
				}
			});

			it("returns the last chunk's CID without waiting when waitForCid is false", async () => {
				const calls = script(
					created(),
					accepted(chunkSize),
					received("bafyearly"),
				);

				const result = await uploadFile(mockConfig, largeFile, "public", {
					waitForCid: false,
				});

				expect(result).toMatchObject({ cid: "bafyearly", size: largeSize });
				expect(calls.map((c) => c.method)).toEqual(["POST", "PATCH", "PATCH"]);
			});
		});

		it("ignores waitForCid: false on a server that registers the file on the last PATCH", async () => {
			const calls = script(
				created(),
				accepted(chunkSize),
				accepted(largeSize, "bafyfinal"),
				fileInfo(),
			);

			const result = await uploadFile(mockConfig, largeFile, "public", {
				waitForCid: false,
			});

			expect(result).toEqual(mockResponse);
			expect(calls[3].url).toContain("cid=bafyfinal");
		});

		describe("reading the file", () => {
			const MiB = 1024 * 1024;

			it.each(kinds)(
				"sends each chunk with the file's bytes at its offset (file %s)",
				async (_kind, file) => {
					const calls = script(
						created(),
						accepted(chunkSize),
						accepted(largeSize, "bafyfinal"),
						fileInfo(),
					);

					const result = await uploadFile(mockConfig, file(), "public");

					expect(result).toEqual(mockResponse);
					expect(calls[0].length).toBe(largeSize.toString());
					const patches = calls.filter((c) => c.method === "PATCH");
					expect(patches).toEqual([
						expect.objectContaining({
							offset: "0",
							size: chunkSize,
							first: byteAt(0),
							last: byteAt(chunkSize - 1),
						}),
						expect.objectContaining({
							offset: chunkSize.toString(),
							size: largeSize - chunkSize,
							first: byteAt(chunkSize),
							last: byteAt(largeSize - 1),
						}),
					]);
				},
			);

			it.each(kinds)(
				"resends the same bytes when a PATCH fails (file %s)",
				async (_kind, file) => {
					const calls = script(
						created(),
						accepted(chunkSize),
						new Response("boom", { status: 500 }),
						uploadStatus(chunkSize),
						accepted(largeSize, "bafyfinal"),
						fileInfo(),
					);

					await uploadFile(mockConfig, file(), "public");

					const patches = calls.filter((c) => c.method === "PATCH");
					expect(patches[1]).toEqual(patches[2]);
					expect(patches[2]).toMatchObject({
						offset: chunkSize.toString(),
						size: largeSize - chunkSize,
						first: byteAt(chunkSize),
						last: byteAt(largeSize - 1),
					});
				},
			);

			it("cuts a File held in memory with slice(), without copying it out of its stream", async () => {
				script(
					created(),
					accepted(chunkSize),
					accepted(largeSize, "bafyfinal"),
					fileInfo(),
				);
				const file = inMemory();
				const stream = jest.spyOn(file, "stream");

				await uploadFile(mockConfig, file, "public");

				expect(stream).not.toHaveBeenCalled();
				const bodies = (global.fetch as jest.Mock).mock.calls
					.filter(([, init]) => init?.method === "PATCH")
					.map(([, init]) => init.body);
				expect(bodies.every((body) => body instanceof Blob)).toBe(true);
			});

			it("cuts a File made of several parts held in memory with slice()", async () => {
				const calls = script(
					created(),
					accepted(chunkSize),
					accepted(largeSize, "bafyfinal"),
					fileInfo(),
				);
				const file = NodeLikeFile.of(
					{ length: 40 * MiB },
					{ length: 40 * MiB },
					{ length: largeSize - 80 * MiB },
				);

				await uploadFile(mockConfig, file, "public");

				expect(file.streamCalls).toBe(0);
				expect(file.sliceCalls).toContainEqual([0, chunkSize]);
				expect(file.sliceCalls).toContainEqual([chunkSize, largeSize]);
				expect(calls.filter((c) => c.method === "PATCH")[1]).toMatchObject({
					first: byteAt(chunkSize),
					last: byteAt(largeSize - 1),
				});
			});

			it("reads a file on disk from its stream, whose end it can check", async () => {
				script(
					created(),
					accepted(chunkSize),
					accepted(largeSize, "bafyfinal"),
					fileInfo(),
				);
				const file = onDisk();

				await uploadFile(mockConfig, file, "public");

				expect(file.streamCalls).toBe(1);
				// Only to look at its last MiB, never to cut a chunk
				expect(file.sliceCalls).toEqual([[largeSize - MiB, largeSize]]);
			});

			it("refuses to complete the upload when the file holds more bytes than its size", async () => {
				// fs.openAsBlob of a file over 4 GiB: `size` wrapped, the stream has every byte
				const calls = script(created(), accepted(chunkSize));

				const error = await uploadFile(
					mockConfig,
					onDisk(largeSize + 4096, largeSize),
					"public",
				).catch((e) => e);

				expect(error).toBeInstanceOf(ValidationError);
				expect(error.message).toContain("larger than its reported size");
				expect(error.message).toContain("4 GiB");
				// The PATCH that would complete a truncated upload is never sent
				expect(calls.map((c) => c.method)).toEqual(["POST", "PATCH"]);
				expect(calls[1].offset).toBe("0");
			});

			it("refuses to complete the upload when one extra byte follows its size", async () => {
				const calls = script(created(), accepted(chunkSize));

				await expect(
					uploadFile(mockConfig, onDisk(largeSize + 1, largeSize), "public"),
				).rejects.toThrow(ValidationError);
				expect(calls.map((c) => c.method)).toEqual(["POST", "PATCH"]);
			});

			// In a File with other parts, a part from fs.openAsBlob over 4 GiB hides 4 GiB or
			// more, more than all the parts after it report (here: 24 MiB)
			const hidden = 24 * MiB;
			it.each([
				[
					"first",
					[
						{ length: 80 * MiB + hidden, reported: 80 * MiB, disk: true },
						{ length: 20 * MiB },
					],
				],
				[
					"between two parts",
					[
						{ length: 20 * MiB },
						{ length: 60 * MiB + hidden, reported: 60 * MiB, disk: true },
						{ length: 20 * MiB },
					],
				],
				[
					"last",
					[
						{ length: 40 * MiB },
						{ length: 60 * MiB + hidden, reported: 60 * MiB, disk: true },
					],
				],
			])(
				"refuses to complete the upload when the part too large for its size comes %s",
				async (_position, parts) => {
					const calls = script(created(), accepted(chunkSize));

					await expect(
						uploadFile(mockConfig, NodeLikeFile.of(...parts), "public"),
					).rejects.toThrow("larger than its reported size");
					expect(calls.map((c) => c.method)).toEqual(["POST", "PATCH"]);
				},
			);

			it("stops when the file's stream ends before its size", async () => {
				const calls = script(created(), accepted(chunkSize));

				await expect(
					uploadFile(mockConfig, onDisk(largeSize - 1, largeSize), "public"),
				).rejects.toThrow("smaller than its reported size");
				expect(calls.map((c) => c.method)).toEqual(["POST", "PATCH"]);
			});
		});

		it("rejects waitForCid: false with vectorize before uploading", async () => {
			const calls = script();

			await expect(
				uploadFile(mockConfig, largeFile, "public", {
					waitForCid: false,
					vectorize: true,
				}),
			).rejects.toThrow(ValidationError);
			expect(calls).toHaveLength(0);
		});
	});
});
