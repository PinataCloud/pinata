import { createGroup } from "../../src/core/functions/groups/createGroup";
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

  it("should create a public network group successfully", async () => {
    const mockResponse: GroupResponseItem = {
      id: "group-123",
      is_public: false,
      name: "Test Group",
      createdAt: "2023-07-26T12:00:00Z",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
    });

    const result = await createGroup(mockConfig, mockOptions, "public");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/v3/groups/public",
      {
        method: "POST",
        headers: {
          Source: "sdk/createGroup",
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
        body: JSON.stringify({
          name: mockOptions.name,
          is_public: undefined,
        }),
      },
    );
    expect(result).toEqual(mockResponse);
  });

  it("should create a private network group successfully", async () => {
    const mockResponse: GroupResponseItem = {
      id: "group-123",
      is_public: false,
      name: "Test Group",
      createdAt: "2023-07-26T12:00:00Z",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
    });

    const result = await createGroup(mockConfig, mockOptions, "private");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/v3/groups/private",
      {
        method: "POST",
        headers: {
          Source: "sdk/createGroup",
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
        body: JSON.stringify({
          name: mockOptions.name,
          is_public: undefined,
        }),
      },
    );
    expect(result).toEqual(mockResponse);
  });

  it("should throw ValidationError if config is missing", async () => {
    await expect(createGroup(undefined, mockOptions, "public")).rejects.toThrow(
      ValidationError,
    );
  });

  it("should throw AuthenticationError on 401 response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValueOnce("Unauthorized"),
    });

    await expect(createGroup(mockConfig, mockOptions, "public")).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("should throw NetworkError on non-401 error response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValueOnce("Server Error"),
    });

    await expect(createGroup(mockConfig, mockOptions, "public")).rejects.toThrow(
      NetworkError,
    );
  });

  it("should throw PinataError on unexpected errors", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("Unexpected error"));

    await expect(createGroup(mockConfig, mockOptions, "public")).rejects.toThrow(
      PinataError,
    );
  });

  it("should handle group creation with a very long name", async () => {
    const longNameOptions: GroupOptions = {
      name: "A".repeat(1000),
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        data: {
          id: "group-123",
          name: longNameOptions.name,
          is_public: false,
          createdAt: "2023-07-26T12:00:00Z",
        },
      }),
    });

    const result = await createGroup(mockConfig, longNameOptions, "public");

    expect(result.name).toEqual(longNameOptions.name);
  });

  it("should handle group creation with special characters in name", async () => {
    const specialNameOptions: GroupOptions = {
      name: "Test @#$%^&*() Group",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        data: {
          id: "group-123",
          name: specialNameOptions.name,
          is_public: false,
          createdAt: "2023-07-26T12:00:00Z",
        },
      }),
    });

    const result = await createGroup(mockConfig, specialNameOptions, "public");

    expect(result.name).toEqual(specialNameOptions.name);
  });

  it("should handle empty group name", async () => {
    const emptyNameOptions: GroupOptions = {
      name: "",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        data: {
          id: "group-123",
          name: "",
          is_public: false,
          createdAt: "2023-07-26T12:00:00Z",
        },
      }),
    });

    const result = await createGroup(mockConfig, emptyNameOptions, "public");

    expect(result.name).toEqual("");
  });

  it("should handle public group creation", async () => {
    const publicGroupOptions: GroupOptions = {
      name: "Public Group",
      isPublic: true,
    };

    const mockResponse: GroupResponseItem = {
      id: "group-123",
      is_public: true,
      name: "Public Group",
      createdAt: "2023-07-26T12:00:00Z",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
    });

    const result = await createGroup(mockConfig, publicGroupOptions, "public");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/v3/groups/public",
      {
        method: "POST",
        headers: {
          Source: "sdk/createGroup",
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
        body: JSON.stringify({
          name: publicGroupOptions.name,
          is_public: publicGroupOptions.isPublic,
        }),
      },
    );
    expect(result).toEqual(mockResponse);
  });
});
