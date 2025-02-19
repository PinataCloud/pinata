import { updateGroup } from "../../src/core/functions/groups/updateGroup";
import type {
  PinataConfig,
  UpdateGroupOptions,
  GroupResponseItem,
} from "../../src";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../src/utils/custom-errors";

describe("updateGroup function", () => {
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

  const mockOptions: UpdateGroupOptions = {
    groupId: "test-group-id",
    name: "Updated Group Name",
  };

  const mockResponse: GroupResponseItem = {
    id: "test-group-id",
    name: "Updated Group Name",
    is_public: false,
    createdAt: "2023-07-26T12:00:00Z",
  };

  it("should update public group successfully", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
    });

    const result = await updateGroup(mockConfig, mockOptions, "public");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/v3/groups/public/test-group-id",
      {
        method: "PUT",
        headers: {
          Source: "sdk/updateGroup",
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
        body: JSON.stringify({ name: mockOptions.name, is_public: undefined }),
      },
    );
    expect(result).toEqual(mockResponse);
  });

  it("should update private group successfully", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
    });

    const result = await updateGroup(mockConfig, mockOptions, "private");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/v3/groups/private/test-group-id",
      {
        method: "PUT",
        headers: {
          Source: "sdk/updateGroup",
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
        body: JSON.stringify({ name: mockOptions.name, is_public: undefined }),
      },
    );
    expect(result).toEqual(mockResponse);
  });

  it("should throw ValidationError if config is missing", async () => {
    await expect(updateGroup(undefined, mockOptions, "public")).rejects.toThrow(
      ValidationError,
    );
  });

  it("should throw AuthenticationError on 401 response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValueOnce("Unauthorized"),
    });

    await expect(updateGroup(mockConfig, mockOptions, "public")).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("should throw NetworkError on non-401 error response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValueOnce("Server Error"),
    });

    await expect(updateGroup(mockConfig, mockOptions, "public")).rejects.toThrow(
      NetworkError,
    );
  });

  it("should throw PinataError on unexpected errors", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("Unexpected error"));

    await expect(updateGroup(mockConfig, mockOptions, "public")).rejects.toThrow(
      PinataError,
    );
  });

  it("should handle updating to an empty name", async () => {
    const emptyNameOptions: UpdateGroupOptions = {
      groupId: "test-group-id",
      name: "",
    };

    const emptyNameResponse: GroupResponseItem = {
      ...mockResponse,
      name: "",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: emptyNameResponse }),
    });

    const result = await updateGroup(mockConfig, emptyNameOptions, "public");

    expect(result.name).toBe("");
  });

  it("should handle updating with a very long name", async () => {
    const longName = "A".repeat(1000);
    const longNameOptions: UpdateGroupOptions = {
      groupId: "test-group-id",
      name: longName,
    };

    const longNameResponse: GroupResponseItem = {
      ...mockResponse,
      name: longName,
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: longNameResponse }),
    });

    const result = await updateGroup(mockConfig, longNameOptions, "public");

    expect(result.name).toBe(longName);
  });

  it("should handle updating a non-existent group", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: jest.fn().mockResolvedValueOnce("Group not found"),
    });

    await expect(
      updateGroup(mockConfig, { ...mockOptions, groupId: "non-existent-id" }, "public"),
    ).rejects.toThrow(NetworkError);
  });

  it("should use correct groupId in URL", async () => {
    const customGroupIdOptions: UpdateGroupOptions = {
      groupId: "custom-group-123",
      name: "Custom Group Name",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        data: {
          ...mockResponse,
          id: customGroupIdOptions.groupId,
        },
      }),
    });

    await updateGroup(mockConfig, customGroupIdOptions, "public");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/v3/groups/public/custom-group-123",
      expect.any(Object),
    );
  });

  it("should handle updating isPublic flag", async () => {
    const publicGroupOptions: UpdateGroupOptions = {
      groupId: "test-group-id",
      isPublic: true,
    };

    const publicGroupResponse: GroupResponseItem = {
      ...mockResponse,
      is_public: true,
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: publicGroupResponse }),
    });

    const result = await updateGroup(mockConfig, publicGroupOptions, "public");

    expect(result.is_public).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/v3/groups/public/test-group-id",
      expect.objectContaining({
        body: JSON.stringify({ name: undefined, is_public: true }),
      }),
    );
  });
});
