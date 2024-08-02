import { pinJobs } from "../../src/core/data/pinJobs";
import type { PinataConfig, PinJobItem, PinJobQuery } from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("pinJobs function", () => {
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

	const mockPinJobItem: PinJobItem = {
		id: "test-job-id",
		ipfs_pin_hash: "Qm...",
		date_queued: "2023-07-26T12:00:00Z",
		name: "test-job",
		status: "retrieving",
		keyvalues: { key: "value" },
		host_nodes: ["node1", "node2"],
		pin_policy: {
			regions: [
				{
					id: "FRA1",
					desiredReplicationCount: 1,
				},
			],
			version: 1,
		},
	};

	it("should list pin jobs successfully", async () => {
		const mockResponse = { rows: [mockPinJobItem] };
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		const result = await pinJobs(mockConfig);

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
		expect(result).toEqual(mockResponse.rows);
	});

	it("should handle query parameters correctly", async () => {
		const mockQuery: PinJobQuery = {
			sort: "ASC",
			status: "retrieving",
			limit: 10,
		};
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ rows: [] }),
		});

		await pinJobs(mockConfig, mockQuery);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining("&status=retrieving&sort=ASC&limit=10"),
			expect.any(Object),
		);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(pinJobs(undefined)).rejects.toThrow(ValidationError);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
		});

		await expect(pinJobs(mockConfig)).rejects.toThrow(AuthenticationError);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
		});

		await expect(pinJobs(mockConfig)).rejects.toThrow(NetworkError);
	});

	it("should throw PinataError on unexpected errors", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValueOnce(new Error("Unexpected error"));

		await expect(pinJobs(mockConfig)).rejects.toThrow(PinataError);
	});

	it("should handle ipfs_pin_hash query parameter", async () => {
		const mockQuery: PinJobQuery = {
			ipfs_pin_hash: "Qm...",
		};
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ rows: [] }),
		});

		await pinJobs(mockConfig, mockQuery);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining("ipfs_pin_hash=Qm..."),
			expect.any(Object),
		);
	});

	it("should handle multiple query parameters", async () => {
		const mockQuery: PinJobQuery = {
			sort: "DSC",
			status: "expired",
			limit: 20,
			offset: 5,
			ipfs_pin_hash: "Qm...",
		};
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ rows: [] }),
		});

		await pinJobs(mockConfig, mockQuery);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining(
				"&ipfs_pin_hash=Qm...&status=expired&sort=DSC&limit=20&offset=5",
			),
			expect.any(Object),
		);
	});
});
