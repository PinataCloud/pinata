import { listGroups } from "../../src/core/functions/groups/listGroups";
import type {
  PinataConfig,
  GroupResponseItem,
  GroupQueryOptions,
  GroupListResponse,
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

  const mockGroupsResponse: GroupListResponse = {
    groups: [
      {
        id: "group-1",
        name: "Test Group 1",
        is_public: false,
        createdAt: "2023-07-26T12:00:00Z",
      },
      {
        id: "group-2",
        name: "Test Group 2",
        is_public: true,
        createdAt: "2023-07-26T13:00:00Z",
      },
    ],
    next_page_token: "next_token",
  };

  it("should list public groups successfully without options", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: mockGroupsResponse }),
    });

    const result = await listGroups(mockConfig, "public");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/v3/groups/public?",
      {
        method: "GET",
        headers: {
          Source: "sdk/listGroups",
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
      },
    );
    expect(result).toEqual(mockGroupsResponse);
  });

  it("should list private groups successfully without options", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: mockGroupsResponse }),
    });

    const result = await listGroups(mockConfig, "private");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/v3/groups/private?",
      {
        method: "GET",
        headers: {
          Source: "sdk/listGroups",
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
      },
    );
    expect(result).toEqual(mockGroupsResponse);
  });

  it("should list public groups with query options", async () => {
    const options: GroupQueryOptions = {
      limit: 5,
      name: "Test",
      pageToken: "token",
      isPublic: true,
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: mockGroupsResponse }),
    });

    await listGroups(mockConfig, "public", options);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/v3/groups/public?pageToken=token&isPublic=true&name=Test&limit=5",
      expect.any(Object),
    );
  });

  it("should list private groups with query options", async () => {
    const options: GroupQueryOptions = {
      limit: 5,
      name: "Test",
      pageToken: "token",
      isPublic: true,
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: mockGroupsResponse }),
    });

    await listGroups(mockConfig, "private", options);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/v3/groups/private?pageToken=token&isPublic=true&name=Test&limit=5",
      expect.any(Object),
    );
  });

  it("should throw ValidationError if config is missing", async () => {
    await expect(listGroups(undefined, "public")).rejects.toThrow(ValidationError);
  });

  it("should throw AuthenticationError on 401 response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValueOnce("Unauthorized"),
    });

    await expect(listGroups(mockConfig, "public")).rejects.toThrow(AuthenticationError);
  });

  it("should throw NetworkError on non-401 error response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValueOnce("Server Error"),
    });

    await expect(listGroups(mockConfig, "public")).rejects.toThrow(NetworkError);
  });

  it("should throw PinataError on unexpected errors", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("Unexpected error"));

    await expect(listGroups(mockConfig, "public")).rejects.toThrow(PinataError);
  });

  it("should handle empty group list", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest
        .fn()
        .mockResolvedValueOnce({ data: { groups: [], next_page_token: null } }),
    });

    const result = await listGroups(mockConfig, "public");

    expect(result).toEqual({ groups: [], next_page_token: null });
  });

  it("should not include nameContains in URL if it's undefined", async () => {
    const options: GroupQueryOptions = {
      limit: 5,
      pageToken: "token",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: mockGroupsResponse }),
    });

    await listGroups(mockConfig, "public", options);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.not.stringContaining("nameContains"),
      expect.any(Object),
    );
  });

  it("should handle large limit", async () => {
    const options: GroupQueryOptions = {
      limit: 1000000,
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: mockGroupsResponse }),
    });

    await listGroups(mockConfig, "public", options);

    expect(global.fetch).toHaveBeenCalledWith(
      `https://api.pinata.cloud/v3/groups/public?limit=${options.limit}`,
      expect.any(Object),
    );
  });

  it("should handle custom endpoint URL", async () => {
    const customConfig: PinataConfig = {
      ...mockConfig,
      endpointUrl: "https://custom.api.pinata.cloud",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: mockGroupsResponse }),
    });

    await listGroups(customConfig, "public");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://custom.api.pinata.cloud/groups/public?",
      expect.any(Object),
    );
  });
});
