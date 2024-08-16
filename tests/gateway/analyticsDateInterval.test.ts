import { analyticsDateInterval } from "../../src/core/gateway/analyticsDateInterval";
import type {
	PinataConfig,
	TimeIntervalGatewayAnalyticsQuery,
	TimeIntervalGatewayAnalyticsResponse,
} from "../../src/core/types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("analyticsDateInterval function", () => {
	let originalFetch: typeof global.fetch;

	beforeEach(() => {
		originalFetch = global.fetch;
		global.fetch = jest.fn();
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	const mockConfig: PinataConfig = {
		pinataJwt: "test-jwt",
		pinataGateway: "test-gateway.pinata.cloud",
	};

	const mockQuery: TimeIntervalGatewayAnalyticsQuery = {
		gateway_domain: "test-gateway.pinata.cloud",
		start_date: "2023-01-01",
		end_date: "2023-01-31",
		date_interval: "day",
	};

	const mockResponse: TimeIntervalGatewayAnalyticsResponse = {
		total_requests: 1000,
		total_bandwidth: 5000000,
		time_periods: [
			{
				period_start_time: "2023-01-01T00:00:00Z",
				requests: 100,
				bandwidth: 500000,
			},
			// ... more periods
		],
	};

	it("should successfully fetch analytics data", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		const result = await analyticsDateInterval(mockConfig, mockQuery);

		expect(result).toEqual(mockResponse);
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining(
				"https://api.pinata.cloud/v3/ipfs/gateway_analytics_time_series?",
			),
			expect.objectContaining({
				method: "GET",
				headers: {
					Source: "sdk/analyticsDateInterval",
					Authorization: `Bearer ${mockConfig.pinataJwt}`,
				},
			}),
		);
	});

	it("should include all query parameters in the URL", async () => {
		const fullQuery: TimeIntervalGatewayAnalyticsQuery = {
			...mockQuery,
			cid: "QmTest123",
			file_name: "test.jpg",
			user_agent: "TestAgent",
			country: "US",
			region: "CA",
			referer: "https://example.com",
			limit: 10,
			sort_order: "asc",
			sort_by: "requests",
		};

		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		await analyticsDateInterval(mockConfig, fullQuery);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringMatching(/cid=QmTest123/),
			expect.any(Object),
		);
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringMatching(/file_name=test\.jpg/),
			expect.any(Object),
		);
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringMatching(/user_agent=TestAgent/),
			expect.any(Object),
		);
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringMatching(/country=US/),
			expect.any(Object),
		);
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringMatching(/region=CA/),
			expect.any(Object),
		);
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringMatching(/referer=https%3A%2F%2Fexample\.com/),
			expect.any(Object),
		);
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringMatching(/limit=10/),
			expect.any(Object),
		);
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringMatching(/sort_order=asc/),
			expect.any(Object),
		);
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringMatching(/sort_by=requests/),
			expect.any(Object),
		);
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringMatching(/by=day/),
			expect.any(Object),
		);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(analyticsDateInterval(undefined, mockQuery)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw ValidationError if pinataJwt is missing", async () => {
		const invalidConfig: Partial<PinataConfig> = {
			pinataGateway: "test-gateway.pinata.cloud",
		};
		await expect(
			analyticsDateInterval(invalidConfig as PinataConfig, mockQuery),
		).rejects.toThrow(ValidationError);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: false,
			status: 401,
			json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
		});

		await expect(analyticsDateInterval(mockConfig, mockQuery)).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
		});

		await expect(analyticsDateInterval(mockConfig, mockQuery)).rejects.toThrow(
			NetworkError,
		);
	});

	it("should throw PinataError on fetch failure", async () => {
		(global.fetch as jest.Mock).mockRejectedValueOnce(
			new Error("Network failure"),
		);

		await expect(analyticsDateInterval(mockConfig, mockQuery)).rejects.toThrow(
			PinataError,
		);
	});

	it("should throw PinataError on unexpected errors", async () => {
		(global.fetch as jest.Mock).mockImplementationOnce(() => {
			throw new Error("Unexpected error");
		});

		await expect(analyticsDateInterval(mockConfig, mockQuery)).rejects.toThrow(
			PinataError,
		);
	});

	it("should handle weekly interval", async () => {
		const weeklyQuery: TimeIntervalGatewayAnalyticsQuery = {
			...mockQuery,
			date_interval: "week",
		};

		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		await analyticsDateInterval(mockConfig, weeklyQuery);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringMatching(/by=week/),
			expect.any(Object),
		);
	});

	it("should use custom endpoint if provided in config", async () => {
		const customEndpointConfig: PinataConfig = {
			...mockConfig,
			endpointUrl: "https://custom-api.pinata.cloud",
		};

		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		await analyticsDateInterval(customEndpointConfig, mockQuery);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining("https://custom-api.pinata.cloud"),
			expect.any(Object),
		);
	});
});
