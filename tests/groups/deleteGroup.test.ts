import { deleteGroup } from "../../src/core/functions/groups/deleteGroup";
import type { PinataConfig, GetGroupOptions } from "../../src";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../src/utils/custom-errors";

describe("deleteGroup function", () => {
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

  it("should delete a public group successfully", async () => {
    const mockStatusText = "OK";

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      statusText: mockStatusText,
      text: jest.fn().mockResolvedValueOnce("Group deleted successfully"),
    });

    const result = await deleteGroup(mockConfig, mockOptions, "public");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/v3/groups/public/test-group-id",
      {
        method: "DELETE",
        headers: {
          Source: "sdk/deleteGroup",
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
      },
    );
    expect(result).toEqual(mockStatusText);
  });

  it("should delete a private group successfully", async () => {
    const mockStatusText = "OK";

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      statusText: mockStatusText,
      text: jest.fn().mockResolvedValueOnce("Group deleted successfully"),
    });

    const result = await deleteGroup(mockConfig, mockOptions, "private");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/v3/groups/private/test-group-id",
      {
        method: "DELETE",
        headers: {
          Source: "sdk/deleteGroup",
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
      },
    );
    expect(result).toEqual(mockStatusText);
  });

  it("should throw ValidationError if config is missing", async () => {
    await expect(deleteGroup(undefined, mockOptions, "public")).rejects.toThrow(
      ValidationError,
    );
  });

  it("should throw AuthenticationError on 401 response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValueOnce("Unauthorized"),
    });

    await expect(deleteGroup(mockConfig, mockOptions, "public")).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("should throw NetworkError on non-401 error response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValueOnce("Server Error"),
    });

    await expect(deleteGroup(mockConfig, mockOptions, "public")).rejects.toThrow(
      NetworkError,
    );
  });

  it("should throw PinataError on unexpected errors", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("Unexpected error"));

    await expect(deleteGroup(mockConfig, mockOptions, "public")).rejects.toThrow(
      PinataError,
    );
  });

  it("should handle deletion of non-existent group", async () => {
    const mockStatusText = "OK";

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      statusText: mockStatusText,
      text: jest.fn().mockResolvedValueOnce("Group not found"),
    });

    const result = await deleteGroup(mockConfig, {
      groupId: "non-existent-id",
    }, "public");

    expect(result).toEqual(mockStatusText);
  });

  it("should handle group id with special characters", async () => {
    const specialIdOptions: GetGroupOptions = {
      groupId: "group@#$%^&*()",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce("Group deleted successfully"),
    });

    await deleteGroup(mockConfig, specialIdOptions, "public");

    expect(global.fetch).toHaveBeenCalledWith(
      `https://api.pinata.cloud/v3/groups/public/${specialIdOptions.groupId}`,
      expect.any(Object),
    );
  });

  it("should handle empty group id", async () => {
    const emptyIdOptions: GetGroupOptions = {
      groupId: "",
    };

    await expect(deleteGroup(mockConfig, emptyIdOptions, "public")).rejects.toThrow(
      PinataError,
    );
  });
});
