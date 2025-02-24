import { queue } from "../../src/core/functions/files/queue";
import type {
	PinataConfig,
	PinQueueItem,
	PinQueueQuery,
	PinQueueResponse,
} from "../../src/core/types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("queue function", () => {
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

	const mockQueueItem: PinQueueItem = {
		id: "test-id",
		cid: undefined,
		ipfs_pin_hash: "Qm...",
		date_queued: "2023-07-26T12:00:00Z",
		name: "test-file",
		status: "retrieving",
		keyvalues: {},
		host_nodes: [],
		pin_policy: {
			regions: [
				{
					id: "test-region",
					desiredReplicationCount: 1,
				},
			],
			version: 1,
		},
	};

	it("should list queue items successfully", async () => {
		const mockResponse = {
			rows: [mockQueueItem],
			nextPageToken: "next_token",
		};
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		const result = await queue(mockConfig);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/pinning/pinJobs?includesCount=false",
			{
				method: "GET",
				headers: {
					Source: "sdk/pinJobs",
					Authorization: `Bearer ${mockConfig.pinataJwt}`,
				},
			},
		);
		expect(result).toEqual({
			rows: [
				{
					...mockQueueItem,
					cid: mockQueueItem.ipfs_pin_hash,
					ipfs_pin_hash: undefined,
				},
			],
			next_page_token: "",
		});
	});

	it("should handle all query parameters correctly", async () => {
		const mockQuery: PinQueueQuery = {
			limit: 10,
			status: "retrieving",
			sort: "ASC",
			ipfs_pin_hash: "Qm...",
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ rows: [], next_page_token: "" }),
		});

		await queue(mockConfig, mockQuery);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining(
				"includesCount=false&ipfs_pin_hash=Qm...&status=retrieving&sort=ASC&limit=10",
			),
			expect.any(Object),
		);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(queue(undefined)).rejects.toThrow(ValidationError);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			text: jest.fn().mockResolvedValueOnce("Unauthorized"),
		});

		await expect(queue(mockConfig)).rejects.toThrow(AuthenticationError);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			text: jest.fn().mockResolvedValueOnce("Server Error"),
		});

		await expect(queue(mockConfig)).rejects.toThrow(NetworkError);
	});

	it("should throw PinataError on fetch failure", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValueOnce(new Error("Network failure"));

		await expect(queue(mockConfig)).rejects.toThrow(PinataError);
	});

	it("should throw PinataError on unexpected errors", async () => {
		global.fetch = jest.fn().mockImplementationOnce(() => {
			throw new Error("Unexpected error");
		});

		await expect(queue(mockConfig)).rejects.toThrow(PinataError);
	});

	it("should use custom endpoint if provided", async () => {
		const customConfig: PinataConfig = {
			...mockConfig,
			endpointUrl: "https://custom.api.pinata.cloud",
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ rows: [], next_page_token: "" }),
		});

		await queue(customConfig);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://custom.api.pinata.cloud/pinning/pinJobs?includesCount=false",
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
			json: jest.fn().mockResolvedValueOnce({ rows: [], next_page_token: "" }),
		});

		await queue(customConfig);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				headers: expect.objectContaining({
					"X-Custom-Header": "CustomValue",
				}),
			}),
		);
	});

	// it("should transform ipfs_pin_hash to cid in response", async () => {
	//   const mockResponseWithIpfsHash = {
	//     rows: [
	//       {
	//         ...mockQueueItem,
	//         ipfs_pin_hash: "Qm...",
	//         cid: undefined,
	//       },
	//     ],
	//     next_page_token: "next_token",
	//   };

	//   const expectedResponse = {
	//     rows: [
	//       {
	//         ...mockQueueItem,
	//         cid: "Qm...",
	//         ipfs_pin_hash: undefined,
	//       },
	//     ],
	//     next_page_token: "",
	//   };

	//   global.fetch = jest.fn().mockResolvedValueOnce({
	//     ok: true,
	//     json: jest.fn().mockResolvedValueOnce(mockResponseWithIpfsHash),
	//   });

	//   const result = await queue(mockConfig);
	//   expect(result).toEqual(expectedResponse);
	// });
});
