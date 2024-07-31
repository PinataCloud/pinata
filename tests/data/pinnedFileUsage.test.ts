import { pinnedFileCount } from "../../src/core/data/pinnedFileUsage";
import type { PinataConfig, UserPinnedDataResponse } from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("pinnedFileCount function", () => {
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

	it("should return pinned file count successfully", async () => {
		const mockResponse: UserPinnedDataResponse = {
			pin_count: 100,
			pin_size_total: 1000000,
			pin_size_with_replications_total: 2000000,
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		const result = await pinnedFileCount(mockConfig);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/data/userPinnedDataTotal",
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${mockConfig.pinataJwt}`,
				},
			},
		);
		expect(result).toEqual(mockResponse.pin_count);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(pinnedFileCount(undefined)).rejects.toThrow(ValidationError);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
		});

		await expect(pinnedFileCount(mockConfig)).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
		});

		await expect(pinnedFileCount(mockConfig)).rejects.toThrow(NetworkError);
	});

	it("should throw PinataError on unexpected errors", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValueOnce(new Error("Unexpected error"));

		await expect(pinnedFileCount(mockConfig)).rejects.toThrow(PinataError);
	});

	it("should handle zero pinned files", async () => {
		const mockResponse: UserPinnedDataResponse = {
			pin_count: 0,
			pin_size_total: 0,
			pin_size_with_replications_total: 0,
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		const result = await pinnedFileCount(mockConfig);

		expect(result).toEqual(0);
	});

	it("should handle large number of pinned files", async () => {
		const mockResponse: UserPinnedDataResponse = {
			pin_count: 1000000,
			pin_size_total: 1000000000000,
			pin_size_with_replications_total: 2000000000000,
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		const result = await pinnedFileCount(mockConfig);

		expect(result).toEqual(1000000);
	});
});
