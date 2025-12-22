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
		global.fetch = jest.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: { ...mockResponse, cid: "QmTestVersion0" } }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: { ...mockResponse, cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi" } }),
			});

		// Upload with CID version 0
		const result0 = await uploadFile(mockConfig, testFile, "public", { cid_version: "v0" as CidVersion });
		
		// Upload with CID version 1
		const result1 = await uploadFile(mockConfig, testFile, "public", { cid_version: "v1" as CidVersion });

		// Verify both uploads
		expect(result0.cid).toBe("QmTestVersion0");
		expect(result1.cid).toBe("bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi");

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

	it("should include CID version in metadata for large file upload", async () => {
		// Create a large file (over 90MB) to trigger chunked upload metadata path
		const largeFileSize = 94371841; // Just over the threshold
		const largeFile = new File([new ArrayBuffer(largeFileSize)], "large-test.txt", {
			type: "text/plain",
		});

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
});
