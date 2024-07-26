import { listGroups } from "../../src/core/groups/listGroups";
import type {
  PinataConfig,
  GroupResponseItem,
  GroupQueryOptions,
} from "../../src";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../src/utils/custom-errors";

describe("listGroups function", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  const mockConfig: PinataConfig = {
    pinataJwt: "test_jwt",
    pinataGateway: "https://test.mypinata.cloud",
  };

  const mockGroups: GroupResponseItem[] = [
    {
      id: "group-1",
      name: "Test Group 1",
      user_id: "user-1",
      createdAt: "2023-07-26T12:00:00Z",
      updatedAt: "2023-07-26T12:00:00Z",
    },
    {
      id: "group-2",
      name: "Test Group 2",
      user_id: "user-1",
      createdAt: "2023-07-26T13:00:00Z",
      updatedAt: "2023-07-26T13:00:00Z",
    },
  ];

  it("should list groups successfully without options", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockGroups),
    });

    const result = await listGroups(mockConfig);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/groups?",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
      },
    );
    expect(result).toEqual(mockGroups);
  });

  it("should list groups with query options", async () => {
    const options: GroupQueryOptions = {
      offset: 10,
      limit: 5,
      nameContains: "Test",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockGroups),
    });

    await listGroups(mockConfig, options);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/groups?offset=10&nameContains=Test&limit=5",
      expect.any(Object),
    );
  });

  it("should throw ValidationError if config is missing", async () => {
    await expect(listGroups(undefined)).rejects.toThrow(ValidationError);
  });

  it("should throw AuthenticationError on 401 response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
    });

    await expect(listGroups(mockConfig)).rejects.toThrow(AuthenticationError);
  });

  it("should throw NetworkError on non-401 error response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
    });

    await expect(listGroups(mockConfig)).rejects.toThrow(NetworkError);
  });

  it("should throw PinataError on unexpected errors", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("Unexpected error"));

    await expect(listGroups(mockConfig)).rejects.toThrow(PinataError);
  });

  it("should handle empty group list", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce([]),
    });

    const result = await listGroups(mockConfig);

    expect(result).toEqual([]);
  });

  it("should not include nameContains in URL if it's undefined", async () => {
    const options: GroupQueryOptions = {
      offset: 10,
      limit: 5,
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockGroups),
    });

    await listGroups(mockConfig, options);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.not.stringContaining("nameContains"),
      expect.any(Object),
    );
  });

  it("should handle large offset and limit", async () => {
    const options: GroupQueryOptions = {
      offset: 1000000,
      limit: 1000000,
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockGroups),
    });

    await listGroups(mockConfig, options);

    expect(global.fetch).toHaveBeenCalledWith(
      `https://api.pinata.cloud/groups?offset=${options.offset}&limit=${options.limit}`,
      expect.any(Object),
    );
  });

  it("should handle negative offset and limit", async () => {
    const options: GroupQueryOptions = {
      offset: -10,
      limit: -5,
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockGroups),
    });

    await listGroups(mockConfig, options);

    expect(global.fetch).toHaveBeenCalledWith(
      `https://api.pinata.cloud/groups?offset=${options.offset}&limit=${options.limit}`,
      expect.any(Object),
    );
  });
});
