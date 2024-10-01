import { listFiles } from "../../src/core/files/list";
import type {
	PinataConfig,
	FileListItem,
	FileListQuery,
	FileListResponse,
} from "../../src/core/types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("listFiles function", () => {
	let originalFetch: typeof fetch;

	beforeEach(() => {
		originalFetch = global.fetch;
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	const mockConfig: PinataConfig = {
		pinataJwt: "test_jwt",
		pinataGateway: "test.cloud",
	};

	const mockFileListItem: FileListItem = {
		id: "test-id",
		name: "test-file",
		cid: "Qm...",
		size: 1234,
		number_of_files: 1,
		mime_type: "text/plain",
		keyvalues: {},
		group_id: "test-group",
		created_at: "2023-07-26T12:00:00Z",
	};

	it("should list files successfully", async () => {
		const mockResponse: FileListResponse = {
			files: [mockFileListItem],
			next_page_token: "next_token",
		};
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		const result = await listFiles(mockConfig);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/v3/files?",
			{
				method: "GET",
				headers: {
					Source: "sdk/listFiles",
					Authorization: `Bearer ${mockConfig.pinataJwt}`,
				},
			},
		);
		expect(result).toEqual(mockResponse);
	});

	it("should handle all query parameters correctly", async () => {
		const mockQuery: FileListQuery = {
			limit: 10,
			pageToken: "test-token",
			cidPending: true,
			name: "test-name",
			group: "test-group",
			mimeType: "text/plain",
			cid: "Qm...",
			order: "ASC",
			metadata: { key1: "value1", key2: "value2" },
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest
				.fn()
				.mockResolvedValueOnce({ data: { files: [], next_page_token: "" } }),
		});

		await listFiles(mockConfig, mockQuery);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining(
				"limit=10&name=test-name&group=test-group&cid=Qm...&mimeType=text%2Fplain&order=ASC&pageToken=test-token&cidPending=true&metadata%5Bkey1%5D=value1&metadata%5Bkey2%5D=value2",
			),
			expect.any(Object),
		);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(listFiles(undefined)).rejects.toThrow(ValidationError);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			text: jest.fn().mockResolvedValueOnce("Unauthorized"),
		});

		await expect(listFiles(mockConfig)).rejects.toThrow(AuthenticationError);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			text: jest.fn().mockResolvedValueOnce("Server Error"),
		});

		await expect(listFiles(mockConfig)).rejects.toThrow(NetworkError);
	});

	it("should throw PinataError on fetch failure", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValueOnce(new Error("Network failure"));

		await expect(listFiles(mockConfig)).rejects.toThrow(PinataError);
	});

	it("should throw PinataError on unexpected errors", async () => {
		global.fetch = jest.fn().mockImplementationOnce(() => {
			throw new Error("Unexpected error");
		});

		await expect(listFiles(mockConfig)).rejects.toThrow(PinataError);
	});

	it("should use custom endpoint if provided", async () => {
		const customConfig: PinataConfig = {
			...mockConfig,
			endpointUrl: "https://custom.api.pinata.cloud",
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest
				.fn()
				.mockResolvedValueOnce({ data: { files: [], next_page_token: "" } }),
		});

		await listFiles(customConfig);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://custom.api.pinata.cloud/files?",
			expect.any(Object),
		);
	});

	it("should use custom headers if provided", async () => {
		const customConfig: PinataConfig = {
			...mockConfig,
			customHeaders: { "X-Custom-Header": "CustomValue" },
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest
				.fn()
				.mockResolvedValueOnce({ data: { files: [], next_page_token: "" } }),
		});

		await listFiles(customConfig);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				headers: expect.objectContaining({
					"X-Custom-Header": "CustomValue",
				}),
			}),
		);
	});
});
