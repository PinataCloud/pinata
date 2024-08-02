import { getSignature } from "../../src/core/signatures/getSignature";
import type { PinataConfig, SignatureResponse } from "../../src/core/types";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../src/utils/custom-errors";

describe("getSignature function", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const mockConfig: PinataConfig = {
    pinataJwt: "test-jwt",
    pinataGateway: "test-gateway.pinata.cloud",
  };

  const mockCid = "QmTest123";

  const mockSignatureResponse: SignatureResponse = {
    cid: "QmTest123",
    signature: "0xTestSignature",
  };

  it("should successfully get a signature", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: mockSignatureResponse }),
    });

    const result = await getSignature(mockConfig, mockCid);

    expect(result).toEqual(mockSignatureResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `https://api.pinata.cloud/v3/ipfs/signature/${mockCid}`,
      {
        method: "GET",
        headers: {
          Source: "sdk/getSignature",
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
      },
    );
  });

  it("should throw ValidationError if config is missing", async () => {
    await expect(getSignature(undefined, mockCid)).rejects.toThrow(ValidationError);
  });

  it("should throw ValidationError if pinataJwt is missing", async () => {
    const invalidConfig: Partial<PinataConfig> = {
      pinataGateway: "test-gateway.pinata.cloud",
    };
    await expect(getSignature(invalidConfig as PinataConfig, mockCid)).rejects.toThrow(
      ValidationError,
    );
  });

  it("should throw AuthenticationError on 401 response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
    });

    await expect(getSignature(mockConfig, mockCid)).rejects.toThrow(AuthenticationError);
  });

  it("should throw NetworkError on non-401 error response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
    });

    await expect(getSignature(mockConfig, mockCid)).rejects.toThrow(NetworkError);
  });

  it("should throw PinataError on fetch failure", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network failure"));

    await expect(getSignature(mockConfig, mockCid)).rejects.toThrow(PinataError);
  });

  it("should throw PinataError on unexpected errors", async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() => {
      throw new Error("Unexpected error");
    });

    await expect(getSignature(mockConfig, mockCid)).rejects.toThrow(PinataError);
  });
});
