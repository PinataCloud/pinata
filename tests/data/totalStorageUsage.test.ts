import { totalStorageUsage } from "../../src/core/data/totalStorageUsage";
import type { PinataConfig, UserPinnedDataResponse } from "../../src";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../src/utils/custom-errors";

describe("totalStorageUsage function", () => {
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

  it("should return total storage usage successfully", async () => {
    const mockResponse: UserPinnedDataResponse = {
      pin_count: 100,
      pin_size_total: 1000000,
      pin_size_with_replications_total: 2000000,
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    const result = await totalStorageUsage(mockConfig);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/data/userPinnedDataTotal",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
      },
    );
    expect(result).toEqual(mockResponse.pin_size_total);
  });

  it("should throw ValidationError if config is missing", async () => {
    await expect(totalStorageUsage(undefined)).rejects.toThrow(ValidationError);
  });

  it("should throw AuthenticationError on 401 response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
    });

    await expect(totalStorageUsage(mockConfig)).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("should throw NetworkError on non-401 error response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
    });

    await expect(totalStorageUsage(mockConfig)).rejects.toThrow(NetworkError);
  });

  it("should throw PinataError on unexpected errors", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("Unexpected error"));

    await expect(totalStorageUsage(mockConfig)).rejects.toThrow(PinataError);
  });

  it("should handle zero storage usage", async () => {
    const mockResponse: UserPinnedDataResponse = {
      pin_count: 0,
      pin_size_total: 0,
      pin_size_with_replications_total: 0,
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    const result = await totalStorageUsage(mockConfig);

    expect(result).toEqual(0);
  });

  it("should handle large storage usage", async () => {
    const mockResponse: UserPinnedDataResponse = {
      pin_count: 1000000,
      pin_size_total: 1000000000000,
      pin_size_with_replications_total: 2000000000000,
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    const result = await totalStorageUsage(mockConfig);

    expect(result).toEqual(1000000000000);
  });

  it("should ignore pin_size_with_replications_total", async () => {
    const mockResponse: UserPinnedDataResponse = {
      pin_count: 100,
      pin_size_total: 1000000,
      pin_size_with_replications_total: 2000000,
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    const result = await totalStorageUsage(mockConfig);

    expect(result).toEqual(1000000);
    expect(result).not.toEqual(mockResponse.pin_size_with_replications_total);
  });
});
