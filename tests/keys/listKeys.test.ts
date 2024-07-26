import { listKeys } from "../../src/core/keys/listKeys";
import type {
  PinataConfig,
  KeyListQuery,
  KeyListItem,
  KeyListResponse,
} from "../../src";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../src/utils/custom-errors";

describe("listKeys function", () => {
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

  const mockKeyListItems: KeyListItem[] = [
    {
      id: "key-1",
      name: "Test Key 1",
      key: "test_key_1",
      secret: "test_secret_1",
      max_uses: 100,
      uses: 50,
      user_id: "user-1",
      scopes: {
        endpoints: {
          pinning: {
            pinFileToIPFS: true,
            pinJSONToIPFS: true,
          },
        },
        admin: false,
      },
      revoked: false,
      createdAt: "2023-07-26T12:00:00Z",
      updatedAt: "2023-07-26T12:00:00Z",
    },
    {
      id: "key-2",
      name: "Test Key 2",
      key: "test_key_2",
      secret: "test_secret_2",
      max_uses: -1,
      uses: 75,
      user_id: "user-1",
      scopes: {
        endpoints: {
          pinning: {
            pinFileToIPFS: true,
            pinJSONToIPFS: true,
          },
        },
        admin: true,
      },
      revoked: false,
      createdAt: "2023-07-26T13:00:00Z",
      updatedAt: "2023-07-26T13:00:00Z",
    },
  ];

  const mockResponse: KeyListResponse = {
    keys: mockKeyListItems,
    count: mockKeyListItems.length,
  };

  it("should list keys successfully without options", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    const result = await listKeys(mockConfig);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/v3/pinata/keys?",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
      },
    );
    expect(result).toEqual(mockKeyListItems);
  });

  it("should list keys with query options", async () => {
    const options: KeyListQuery = {
      offset: 10,
      revoked: false,
      limitedUse: true,
      name: "Test",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    await listKeys(mockConfig, options);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/v3/pinata/keys?offset=10&revoked=false&limitedUse=true&name=Test",
      expect.any(Object),
    );
  });

  it("should throw ValidationError if config is missing", async () => {
    await expect(listKeys(undefined)).rejects.toThrow(ValidationError);
  });

  it("should throw AuthenticationError on 401 response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
    });

    await expect(listKeys(mockConfig)).rejects.toThrow(AuthenticationError);
  });

  it("should throw NetworkError on non-401 error response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
    });

    await expect(listKeys(mockConfig)).rejects.toThrow(NetworkError);
  });

  it("should throw PinataError on unexpected errors", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("Unexpected error"));

    await expect(listKeys(mockConfig)).rejects.toThrow(PinataError);
  });

  it("should handle empty key list", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ keys: [], count: 0 }),
    });

    const result = await listKeys(mockConfig);

    expect(result).toEqual([]);
  });

  it("should not include name in URL if it's undefined", async () => {
    const options: KeyListQuery = {
      offset: 10,
      revoked: false,
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    await listKeys(mockConfig, options);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.not.stringContaining("name="),
      expect.any(Object),
    );
  });

  it("should handle large offset", async () => {
    const options: KeyListQuery = {
      offset: 1000000,
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    await listKeys(mockConfig, options);

    expect(global.fetch).toHaveBeenCalledWith(
      `https://api.pinata.cloud/v3/pinata/keys?offset=${options.offset}`,
      expect.any(Object),
    );
  });

  it("should handle boolean query parameters correctly", async () => {
    const options: KeyListQuery = {
      revoked: true,
      limitedUse: false,
      exhausted: true,
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    await listKeys(mockConfig, options);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/v3/pinata/keys?revoked=true&limitedUse=false&exhausted=true",
      expect.any(Object),
    );
  });
});
