import { uploadFile } from "../../src/core/uploads/file";
import type {
	PinataConfig,
	UploadOptions,
	UploadResponse,
	PinataMetadata,
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
		user_id: "testUserId",
		group_id: null,
	};

	it("should upload file successfully", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		const result = await uploadFile(mockConfig, mockFile);

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

	it("should handle upload options", async () => {
		const mockMetadata: PinataMetadata = {
			name: "Custom File Name",
			keyValues: {
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

		await uploadFile(mockConfig, mockFile, mockOptions);

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
	});

	it("should use custom JWT if provided in options", async () => {
		const customJwt = "custom-jwt";
		const mockOptions: UploadOptions = {
			keys: customJwt,
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		await uploadFile(mockConfig, mockFile, mockOptions);

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
		await expect(uploadFile(undefined, mockFile)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			text: jest.fn().mockResolvedValueOnce("Unauthorized"),
		});

		await expect(uploadFile(mockConfig, mockFile)).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			text: jest.fn().mockResolvedValueOnce("Server Error"),
		});

		await expect(uploadFile(mockConfig, mockFile)).rejects.toThrow(
			NetworkError,
		);
	});

	it("should throw PinataError on fetch failure", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValueOnce(new Error("Network failure"));

		await expect(uploadFile(mockConfig, mockFile)).rejects.toThrow(PinataError);
	});
});
