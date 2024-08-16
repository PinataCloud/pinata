import { analyticsTopUsage } from "../../src/core/gateway/analyticsTopUsage";
import type {
	PinataConfig,
	TopGatewayAnalyticsQuery,
	TopGatewayAnalyticsItem,
} from "../../src/core/types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("analyticsTopUsage function", () => {
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

	const mockQuery: TopGatewayAnalyticsQuery = {
		gateway_domain: "test-gateway.pinata.cloud",
		start_date: "2023-01-01",
		end_date: "2023-01-31",
		sort_by: "requests",
		attribute: "cid",
	};

	const mockResponse: TopGatewayAnalyticsItem[] = [
		{
			value: "QmTest123",
			requests: 1000,
			bandwidth: 5000000,
		},
		{
			value: "QmTest456",
			requests: 500,
			bandwidth: 2500000,
		},
	];

	it("should successfully fetch top analytics data", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		const result = await analyticsTopUsage(mockConfig, mockQuery);

		expect(result).toEqual(mockResponse);
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining(
				"https://api.pinata.cloud/v3/ipfs/gateway_analytics_top?",
			),
			expect.objectContaining({
				method: "GET",
				headers: {
					Source: "sdk/analyticsTopUsage",
					Authorization: `Bearer ${mockConfig.pinataJwt}`,
				},
			}),
		);
	});

	it("should include all query parameters in the URL", async () => {
		const fullQuery: TopGatewayAnalyticsQuery = {
			...mockQuery,
			cid: "QmTest789",
			file_name: "test.jpg",
			user_agent: "TestAgent",
			country: "US",
			region: "CA",
			referer: "https://example.com",
			limit: 10,
			sort_order: "asc",
		};

		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		await analyticsTopUsage(mockConfig, fullQuery);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringMatching(/includesCount=false/),
			expect.any(Object),
		);
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringMatching(/cid=QmTest789/),
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
			expect.stringMatching(/by=cid/),
			expect.any(Object),
		);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(analyticsTopUsage(undefined, mockQuery)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw ValidationError if pinataJwt is missing", async () => {
		const invalidConfig: Partial<PinataConfig> = {
			pinataGateway: "test-gateway.pinata.cloud",
		};
		await expect(
			analyticsTopUsage(invalidConfig as PinataConfig, mockQuery),
		).rejects.toThrow(ValidationError);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: false,
			status: 401,
			json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
		});

		await expect(analyticsTopUsage(mockConfig, mockQuery)).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
		});

		await expect(analyticsTopUsage(mockConfig, mockQuery)).rejects.toThrow(
			NetworkError,
		);
	});

	it("should throw PinataError on fetch failure", async () => {
		(global.fetch as jest.Mock).mockRejectedValueOnce(
			new Error("Network failure"),
		);

		await expect(analyticsTopUsage(mockConfig, mockQuery)).rejects.toThrow(
			PinataError,
		);
	});

	it("should throw PinataError on unexpected errors", async () => {
		(global.fetch as jest.Mock).mockImplementationOnce(() => {
			throw new Error("Unexpected error");
		});

		await expect(analyticsTopUsage(mockConfig, mockQuery)).rejects.toThrow(
			PinataError,
		);
	});

	it("should handle different attribute types", async () => {
		const attributes: Array<TopGatewayAnalyticsQuery["attribute"]> = [
			"country",
			"region",
			"user_agent",
			"referer",
			"file_name",
		];

		for (const attribute of attributes) {
			const query: TopGatewayAnalyticsQuery = { ...mockQuery, attribute };

			(global.fetch as jest.Mock).mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
			});

			await analyticsTopUsage(mockConfig, query);

			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringMatching(new RegExp(`by=${attribute}`)),
				expect.any(Object),
			);
		}
	});

	it("should handle sorting by bandwidth", async () => {
		const bandwidthQuery: TopGatewayAnalyticsQuery = {
			...mockQuery,
			sort_by: "bandwidth",
		};

		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		await analyticsTopUsage(mockConfig, bandwidthQuery);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringMatching(/sort_by=bandwidth/),
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

		await analyticsTopUsage(customEndpointConfig, mockQuery);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining("https://custom-api.pinata.cloud"),
			expect.any(Object),
		);
	});
});
