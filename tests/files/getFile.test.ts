import {
	AuthenticationError,
	NetworkError,
	PinataError,
	ValidationError,
} from "../../src/utils";
import { FileListItem, PinataConfig } from "../../src/core";
import { getFile } from "../../src/core/functions/files/getFile";

describe("getFile function", () => {
	describe("public network", () => {
		let originalFetch: typeof fetch;

		beforeEach(() => {
			originalFetch = global.fetch;
		});

		afterEach(() => {
			global.fetch = originalFetch;
			jest.clearAllMocks();
		});

		const mockConfig: PinataConfig = {
			pinataJwt: "test_jwt",
			pinataGateway: "https://test.mypinata.cloud",
		};

		const mockFile: FileListItem = {
			id: "test-id",
			name: "test-file",
			cid: "QmTest123",
			size: 1234,
			number_of_files: 1,
			mime_type: "text/plain",
			keyvalues: {},
			group_id: null,
			created_at: "2023-07-26T12:00:00Z",
		};

		it("should get file successfully", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockFile }),
			});

			const result = await getFile(mockConfig, "test-id", "public");

			expect(global.fetch).toHaveBeenCalledWith(
				"https://api.pinata.cloud/v3/files/public/test-id",
				expect.objectContaining({
					method: "GET",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${mockConfig.pinataJwt}`,
						Source: "sdk/getFile",
					},
				}),
			);
			expect(result).toEqual(mockFile);
		});

		it("should throw ValidationError if config is missing", async () => {
			await expect(getFile(undefined, "test-id", "public")).rejects.toThrow(
				ValidationError,
			);
		});

		it("should throw AuthenticationError on 401 response", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: jest.fn().mockResolvedValueOnce("Unauthorized"),
			});

			await expect(getFile(mockConfig, "test-id", "public")).rejects.toThrow(
				AuthenticationError,
			);
		});

		it("should throw NetworkError on non-401 error response", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: jest.fn().mockResolvedValueOnce("Server Error"),
			});

			await expect(getFile(mockConfig, "test-id", "public")).rejects.toThrow(
				NetworkError,
			);
		});

		it("should throw PinataError on unexpected errors", async () => {
			global.fetch = jest
				.fn()
				.mockRejectedValueOnce(new Error("Unexpected error"));

			await expect(getFile(mockConfig, "test-id", "public")).rejects.toThrow(
				PinataError,
			);
		});
	});

	describe("private network", () => {
		let originalFetch: typeof fetch;

		beforeEach(() => {
			originalFetch = global.fetch;
		});

		afterEach(() => {
			global.fetch = originalFetch;
			jest.clearAllMocks();
		});

		const mockConfig: PinataConfig = {
			pinataJwt: "test_jwt",
			pinataGateway: "https://test.mypinata.cloud",
		};

		const mockFile: FileListItem = {
			id: "test-id",
			name: "test-file",
			cid: "QmTest123",
			size: 1234,
			number_of_files: 1,
			mime_type: "text/plain",
			keyvalues: {},
			group_id: null,
			created_at: "2023-07-26T12:00:00Z",
		};

		it("should get file successfully", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockFile }),
			});

			const result = await getFile(mockConfig, "test-id", "private");

			expect(global.fetch).toHaveBeenCalledWith(
				"https://api.pinata.cloud/v3/files/private/test-id",
				expect.objectContaining({
					method: "GET",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${mockConfig.pinataJwt}`,
						Source: "sdk/getFile",
					},
				}),
			);
			expect(result).toEqual(mockFile);
		});

		it("should throw ValidationError if config is missing", async () => {
			await expect(getFile(undefined, "test-id", "private")).rejects.toThrow(
				ValidationError,
			);
		});

		it("should throw AuthenticationError on 401 response", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: jest.fn().mockResolvedValueOnce("Unauthorized"),
			});

			await expect(getFile(mockConfig, "test-id", "private")).rejects.toThrow(
				AuthenticationError,
			);
		});

		it("should throw NetworkError on non-401 error response", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: jest.fn().mockResolvedValueOnce("Server Error"),
			});

			await expect(getFile(mockConfig, "test-id", "private")).rejects.toThrow(
				NetworkError,
			);
		});

		it("should throw PinataError on unexpected errors", async () => {
			global.fetch = jest
				.fn()
				.mockRejectedValueOnce(new Error("Unexpected error"));

			await expect(getFile(mockConfig, "test-id", "private")).rejects.toThrow(
				PinataError,
			);
		});
	});
});
