import { getGroup } from "../../src/core/groups/getGroup";
import type {
  PinataConfig,
  GetGroupOptions,
  GroupResponseItem,
} from "../../src";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../src/utils/custom-errors";

describe("getGroup function", () => {
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

  const mockOptions: GetGroupOptions = {
    groupId: "test-group-id",
  };

  it("should get a group successfully", async () => {
    const mockResponse: GroupResponseItem = {
      id: "test-group-id",
      name: "Test Group",
      user_id: "test-user-id",
      createdAt: "2023-07-26T12:00:00Z",
      updatedAt: "2023-07-26T12:00:00Z",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    const result = await getGroup(mockConfig, mockOptions);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/groups/test-group-id",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
      },
    );
    expect(result).toEqual(mockResponse);
  });

  it("should throw ValidationError if config is missing", async () => {
    await expect(getGroup(undefined, mockOptions)).rejects.toThrow(
      ValidationError,
    );
  });

  it("should throw AuthenticationError on 401 response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
    });

    await expect(getGroup(mockConfig, mockOptions)).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("should throw NetworkError on non-401 error response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
    });

    await expect(getGroup(mockConfig, mockOptions)).rejects.toThrow(
      NetworkError,
    );
  });

  it("should throw PinataError on unexpected errors", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("Unexpected error"));

    await expect(getGroup(mockConfig, mockOptions)).rejects.toThrow(
      PinataError,
    );
  });

  it("should handle retrieval of non-existent group", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: jest.fn().mockResolvedValueOnce({ error: "Group not found" }),
    });

    await expect(
      getGroup(mockConfig, { groupId: "non-existent-id" }),
    ).rejects.toThrow(NetworkError);
  });

  it("should handle group id with special characters", async () => {
    const specialIdOptions: GetGroupOptions = {
      groupId: "group@#$%^&*()",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest
        .fn()
        .mockResolvedValueOnce({
          id: specialIdOptions.groupId,
          name: "Special Group",
        }),
    });

    await getGroup(mockConfig, specialIdOptions);

    expect(global.fetch).toHaveBeenCalledWith(
      `https://api.pinata.cloud/groups/${specialIdOptions.groupId}`,
      expect.any(Object),
    );
  });

  it("should handle empty group id", async () => {
    const emptyIdOptions: GetGroupOptions = {
      groupId: "",
    };

    await expect(getGroup(mockConfig, emptyIdOptions)).rejects.toThrow(
      PinataError,
    );
  });

  it("should handle a group with no name", async () => {
    const mockResponseNoName: GroupResponseItem = {
      id: "test-group-id",
      name: "",
      user_id: "test-user-id",
      createdAt: "2023-07-26T12:00:00Z",
      updatedAt: "2023-07-26T12:00:00Z",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponseNoName),
    });

    const result = await getGroup(mockConfig, mockOptions);

    expect(result.name).toBe("");
  });
});
