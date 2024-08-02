import { deleteGroup } from "../../src/core/groups/deleteGroup";
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

  it("should delete a group successfully", async () => {
    const mockResponse = "Group deleted successfully";

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    const result = await deleteGroup(mockConfig, mockOptions);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/groups/test-group-id",
      {
        method: "DELETE",
        headers: {
          Source: "sdk/deleteGroup",
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
      },
    );
    expect(result).toEqual(mockResponse);
  });

  it("should throw ValidationError if config is missing", async () => {
    await expect(deleteGroup(undefined, mockOptions)).rejects.toThrow(ValidationError);
  });

  it("should throw AuthenticationError on 401 response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
    });

    await expect(deleteGroup(mockConfig, mockOptions)).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("should throw NetworkError on non-401 error response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
    });

    await expect(deleteGroup(mockConfig, mockOptions)).rejects.toThrow(NetworkError);
  });

  it("should throw PinataError on unexpected errors", async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("Unexpected error"));

    await expect(deleteGroup(mockConfig, mockOptions)).rejects.toThrow(PinataError);
  });

  it("should handle deletion of non-existent group", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce("Group not found"),
    });

    const result = await deleteGroup(mockConfig, {
      groupId: "non-existent-id",
    });

    expect(result).toEqual("Group not found");
  });

  it("should handle group id with special characters", async () => {
    const specialIdOptions: GetGroupOptions = {
      groupId: "group@#$%^&*()",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce("Group deleted successfully"),
    });

    await deleteGroup(mockConfig, specialIdOptions);

    expect(global.fetch).toHaveBeenCalledWith(
      `https://api.pinata.cloud/groups/${specialIdOptions.groupId}`,
      expect.any(Object),
    );
  });

  it("should handle empty group id", async () => {
    const emptyIdOptions: GetGroupOptions = {
      groupId: "",
    };

    await expect(deleteGroup(mockConfig, emptyIdOptions)).rejects.toThrow(PinataError);
  });
});
