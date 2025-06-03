import {
	PinataConfig,
	TimeIntervalAnalyticsQuery,
	TimeIntervalAnalyticsResponse,
	TimePeriodItem,
	analyticsDateInterval,
} from "../../src/core";
import {
	ValidationError,
	AuthenticationError,
	NetworkError,
	PinataError,
} from "../../src/utils";

describe("analyticsDateInterval function", () => {
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

	const mockTimePeriodItem: TimePeriodItem = {
		period_start_time: "2023-01-01T00:00:00Z",
		requests: 100,
		bandwidth: 1000,
	};

	it("should get analytics successfully", async () => {
		const mockResponse: TimeIntervalAnalyticsResponse = {
			total_requests: 500,
			total_bandwidth: 5000,
			time_periods: [mockTimePeriodItem],
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		const result = await analyticsDateInterval(mockConfig);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/v3/ipfs/gateway_analytics_time_series?",
			{
				method: "GET",
				headers: {
					Source: "sdk/analyticsDateInterval",
					Authorization: `Bearer ${mockConfig.pinataJwt}`,
				},
			},
		);
		expect(result).toEqual(mockResponse);
	});

	it("should handle all query parameters correctly", async () => {
		const mockQuery: TimeIntervalAnalyticsQuery = {
			gateway_domain: "test.gateway.com",
			start_date: "2023-01-01",
			end_date: "2023-12-31",
			cid: "QmTest",
			file_name: "test.txt",
			user_agent: "test-agent",
			country: "US",
			region: "test-region",
			referer: "test-referer",
			limit: 10,
			sort_order: "asc",
			sort_by: "requests",
			date_interval: "day",
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: [] }),
		});

		await analyticsDateInterval(mockConfig, mockQuery);

		const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0];
		const url = new URL(fetchCall);
		const params = new URLSearchParams(url.search);

		expect(params.get("gateway_domain")).toBe("test.gateway.com");
		expect(params.get("start_date")).toBe("2023-01-01");
		expect(params.get("end_date")).toBe("2023-12-31");
		expect(params.get("cid")).toBe("QmTest");
		expect(params.get("file_name")).toBe("test.txt");
		expect(params.get("user_agent")).toBe("test-agent");
		expect(params.get("country")).toBe("US");
		expect(params.get("region")).toBe("test-region");
		expect(params.get("referer")).toBe("test-referer");
		expect(params.get("limit")).toBe("10");
		expect(params.get("sort_order")).toBe("asc");
		expect(params.get("sort_by")).toBe("requests");
		expect(params.get("by")).toBe("day");
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(analyticsDateInterval(undefined)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			text: jest.fn().mockResolvedValueOnce("Unauthorized"),
		});

		await expect(analyticsDateInterval(mockConfig)).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			text: jest.fn().mockResolvedValueOnce("Server Error"),
		});

		await expect(analyticsDateInterval(mockConfig)).rejects.toThrow(
			NetworkError,
		);
	});

	it("should throw PinataError on fetch failure", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValueOnce(new Error("Network failure"));

		await expect(analyticsDateInterval(mockConfig)).rejects.toThrow(
			PinataError,
		);
	});

	it("should throw PinataError on unexpected errors", async () => {
		global.fetch = jest.fn().mockImplementationOnce(() => {
			throw new Error("Unexpected error");
		});

		await expect(analyticsDateInterval(mockConfig)).rejects.toThrow(
			PinataError,
		);
	});

	it("should use custom endpoint if provided", async () => {
		const customConfig: PinataConfig = {
			...mockConfig,
			endpointUrl: "https://custom.api.pinata.cloud",
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: [] }),
		});

		await analyticsDateInterval(customConfig);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://custom.api.pinata.cloud/ipfs/gateway_analytics_time_series?",
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
			json: jest.fn().mockResolvedValueOnce({ data: [] }),
		});

		await analyticsDateInterval(customConfig);

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
