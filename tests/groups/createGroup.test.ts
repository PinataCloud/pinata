import { createGroup } from "../../src/core/groups/createGroup";
import type { PinataConfig, GroupOptions, GroupResponseItem } from "../../src";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../src/utils/custom-errors";

describe("createGroup function", () => {
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

  const mockOptions: GroupOptions = {
    name: "Test Group",
  };

  it("should create a group successfully", async () => {
    const mockResponse: GroupResponseItem = {
      id: "group-123",
      user_id: "user-456",
      name: "Test Group",
      updatedAt: "2023-07-26T12:00:00Z",
      createdAt: "2023-07-26T12:00:00Z",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    const result = await createGroup(mockConfig, mockOptions);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/groups",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
        body: JSON.stringify(mockOptions),
      },
    );
    expect(result).toEqual(mockResponse);
  });

  it("should throw ValidationError if config is missing", async () => {
    await expect(createGroup(undefined, mockOptions)).rejects.toThrow(
      ValidationError,
    );
  });

  it("should throw AuthenticationError on 401 response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
    });

    await expect(createGroup(mockConfig, mockOptions)).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("should throw NetworkError on non-401 error response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
    });

    await expect(createGroup(mockConfig, mockOptions)).rejects.toThrow(
      NetworkError,
    );
  });

  it("should throw PinataError on unexpected errors", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("Unexpected error"));

    await expect(createGroup(mockConfig, mockOptions)).rejects.toThrow(
      PinataError,
    );
  });

  it("should handle group creation with a very long name", async () => {
    const longNameOptions: GroupOptions = {
      name: "A".repeat(1000),
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest
        .fn()
        .mockResolvedValueOnce({ id: "group-123", name: longNameOptions.name }),
    });

    const result = await createGroup(mockConfig, longNameOptions);

    expect(result.name).toEqual(longNameOptions.name);
  });

  it("should handle group creation with special characters in name", async () => {
    const specialNameOptions: GroupOptions = {
      name: "Test @#$%^&*() Group",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest
        .fn()
        .mockResolvedValueOnce({
          id: "group-123",
          name: specialNameOptions.name,
        }),
    });

    const result = await createGroup(mockConfig, specialNameOptions);

    expect(result.name).toEqual(specialNameOptions.name);
  });

  it("should handle empty group name", async () => {
    const emptyNameOptions: GroupOptions = {
      name: "",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ id: "group-123", name: "" }),
    });

    const result = await createGroup(mockConfig, emptyNameOptions);

    expect(result.name).toEqual("");
  });
});
