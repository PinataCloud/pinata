import { listFiles } from "../../src/core/data/listFiles";
import type { PinataConfig, PinListItem, PinListQuery } from "../../src";
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

	const mockPinListItem: PinListItem = {
		id: "test-id",
		ipfs_pin_hash: "Qm...",
		size: 1234,
		user_id: "test-user",
		date_pinned: "2023-07-26T12:00:00Z",
		date_unpinned: null,
		metadata: {
			name: "test-file",
			keyvalues: { key: "value" },
		},
		regions: [
			{
				regionId: "FRA1",
				currentReplicationCount: 1,
				desiredReplicationCount: 1,
			},
		],
		mime_type: "text/plain",
		number_of_files: 1,
	};

	it("should list files successfully", async () => {
		const mockResponse = { rows: [mockPinListItem] };
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		const result = await listFiles(mockConfig);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/data/pinList?status=pinned&includesCount=false",
			{
				method: "GET",
				headers: {
					Source: "sdk/listFiles",
					Authorization: `Bearer ${mockConfig.pinataJwt}`,
				},
			},
		);
		expect(result).toEqual(mockResponse.rows);
	});

	it("should handle all query parameters correctly", async () => {
		const mockQuery: PinListQuery = {
			cid: "test-cid",
			pinStart: "2023-01-01",
			pinEnd: "2023-12-31",
			pinSizeMin: 100,
			pinSizeMax: 1000,
			pageLimit: 10,
			pageOffset: 5,
			name: "test-name",
			key: "test-key",
			value: "test-value",
			operator: "eq",
			groupId: "test-group",
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ rows: [] }),
		});

		await listFiles(mockConfig, mockQuery);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining(
				"cid=test-cid&pinStart=2023-01-01&pinEnd=2023-12-31&pinSizeMin=100&pinSizeMax=1000&pageLimit=10&pageOffset=5&groupId=test-group&metadata%5Bname%5D=test-name&metadata%5Bkeyvalues%5D=%7B%22test-key%22%3A%7B%22value%22%3A%22test-value%22%2C%22op%22%3A%22eq%22%7D%7D",
			),
			expect.any(Object),
		);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(listFiles(undefined)).rejects.toThrow(ValidationError);
	});

	it("should throw ValidationError if pinataJwt is missing", async () => {
		const invalidConfig: Partial<PinataConfig> = {
			pinataGateway: "test.cloud",
			// pinataJwt is intentionally omitted
		};
		await expect(listFiles(invalidConfig as PinataConfig)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
		});

		await expect(listFiles(mockConfig)).rejects.toThrow(AuthenticationError);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
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
});
