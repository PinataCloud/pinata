import { PinataSDK } from "../src/core/pinataSDK";
import type { PinataConfig } from "../src";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../src/utils/custom-errors";

describe("PinataSDK", () => {
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

  const mockAuthTestResponse = "Congratulations! You are communicating with the Pinata API!";

  it("should initialize PinataSDK with config", () => {
    const sdk = new PinataSDK(mockConfig);
    expect(sdk.config).toEqual(mockConfig);
  });

  it("should test authentication successfully", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockAuthTestResponse),
    });

    const sdk = new PinataSDK(mockConfig);
    const result = await sdk.testAuthentication();

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/data/testAuthentication",
      expect.objectContaining({
        method: "GET",
        headers: {
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
          Source: "sdk/testAuthentication",
        },
      }),
    );
    expect(result).toEqual(mockAuthTestResponse);
  });

  it("should throw AuthenticationError on 401 response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValueOnce("Unauthorized"),
    });

    const sdk = new PinataSDK(mockConfig);
    await expect(sdk.testAuthentication()).rejects.toThrow(AuthenticationError);
  });

  it("should throw NetworkError on non-401 error response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValueOnce("Server Error"),
    });

    const sdk = new PinataSDK(mockConfig);
    await expect(sdk.testAuthentication()).rejects.toThrow(NetworkError);
  });

  it("should set new headers", () => {
    const sdk = new PinataSDK(mockConfig);
    const newHeaders = { "Custom-Header": "TestValue" };
    sdk.setNewHeaders(newHeaders);

    expect(sdk.config?.customHeaders).toEqual(
      expect.objectContaining(newHeaders),
    );
  });
});
