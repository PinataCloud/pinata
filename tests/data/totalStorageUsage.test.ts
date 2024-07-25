import { totalStorageUsage } from "../../src/core/data/totalStorageUsage";
import type { PinataConfig } from "../../src";

describe("totalStorageUsage", () => {
	const mockConfig: PinataConfig = {
		pinataJwt: "test-jwt",
	};

	const mockResponse = {
		pin_count: 100,
		pin_size_total: 1000000,
		pin_size_with_replications_total: 2000000,
	};

	let originalFetch: typeof fetch;

	beforeEach(() => {
		originalFetch = global.fetch;
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it("should fetch total storage usage", async () => {
		global.fetch = jest.fn().mockResolvedValue({
			json: jest.fn().mockResolvedValue(mockResponse),
		} as unknown as Response);

		const result = await totalStorageUsage(mockConfig);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/data/userPinnedDataTotal",
			{
				method: "GET",
				headers: {
					Authorization: "Bearer test-jwt",
				},
			},
		);
		expect(result).toEqual(mockResponse.pin_size_total);
	});

	it("should handle errors", async () => {
		const error = new Error("API error");
		global.fetch = jest.fn().mockRejectedValue(error);

		await expect(totalStorageUsage(mockConfig)).rejects.toThrow("API error");
	});
});
