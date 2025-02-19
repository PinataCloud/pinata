import { analyticsTopUsage } from "../../src/core/functions/analytics/analyticsTopUsage";
import type {
  PinataConfig,
  TopAnalyticsQuery,
  TopAnalyticsResponse,
  TopAnalyticsItem
} from "../../src/core/types";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../src/utils/custom-errors";

describe("analyticsTopUsage function", () => {
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

  const mockTopAnalyticsItem: TopAnalyticsItem = {
    value: "test-value",
    requests: 100,
    bandwidth: 1000
  };

  it("should get analytics successfully", async () => {
    const mockResponse: TopAnalyticsResponse = {
      data: [mockTopAnalyticsItem]
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    const result = await analyticsTopUsage(mockConfig);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/v3/ipfs/gateway_analytics_top?",
      {
        method: "GET",
        headers: {
          Source: "sdk/analyticsTopUsage",
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
      },
    );
    expect(result).toEqual(mockResponse);
  });

  it("should handle all query parameters correctly", async () => {
    const mockQuery: TopAnalyticsQuery = {
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
      attribute: "cid"
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: [] }),
    });

    await analyticsTopUsage(mockConfig, mockQuery);

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0];
    const url = new URL(fetchCall);
    const params = new URLSearchParams(url.search);

    // Check that each parameter exists with correct value
    expect(params.get('gateway_domain')).toBe('test.gateway.com');
    expect(params.get('start_date')).toBe('2023-01-01');
    expect(params.get('end_date')).toBe('2023-12-31');
    expect(params.get('cid')).toBe('QmTest');
    expect(params.get('file_name')).toBe('test.txt');
    expect(params.get('user_agent')).toBe('test-agent');
    expect(params.get('country')).toBe('US');
    expect(params.get('region')).toBe('test-region');
    expect(params.get('referer')).toBe('test-referer');
    expect(params.get('limit')).toBe('10');
    expect(params.get('sort_order')).toBe('asc');
    expect(params.get('sort_by')).toBe('requests');
    expect(params.get('by')).toBe('cid');
  });

  it("should throw ValidationError if config is missing", async () => {
    await expect(analyticsTopUsage(undefined)).rejects.toThrow(ValidationError);
  });

  it("should throw AuthenticationError on 401 response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValueOnce("Unauthorized"),
    });

    await expect(analyticsTopUsage(mockConfig)).rejects.toThrow(AuthenticationError);
  });

  it("should throw NetworkError on non-401 error response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValueOnce("Server Error"),
    });

    await expect(analyticsTopUsage(mockConfig)).rejects.toThrow(NetworkError);
  });

  it("should throw PinataError on fetch failure", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("Network failure"));

    await expect(analyticsTopUsage(mockConfig)).rejects.toThrow(PinataError);
  });

  it("should throw PinataError on unexpected errors", async () => {
    global.fetch = jest.fn().mockImplementationOnce(() => {
      throw new Error("Unexpected error");
    });

    await expect(analyticsTopUsage(mockConfig)).rejects.toThrow(PinataError);
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

    await analyticsTopUsage(customConfig);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://custom.api.pinata.cloud/ipfs/gateway_analytics_top?",
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

    await analyticsTopUsage(customConfig);

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
