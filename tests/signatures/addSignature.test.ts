import { addSignature } from "../../src/core/signatures/addSignature";
import type {
  PinataConfig,
  SignatureOptions,
  SignatureResponse,
} from "../../src/core/types";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../src/utils/custom-errors";

describe("addSignature function", () => {
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

  const mockOptions: SignatureOptions = {
    cid: "QmTest123",
    signature: "0xTestSignature",
  };

  const mockSignatureResponse: SignatureResponse = {
    cid: "QmTest123",
    signature: "0xTestSignature",
  };

  it("should successfully add a signature", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: mockSignatureResponse }),
    });

    const result = await addSignature(mockConfig, mockOptions);

    expect(result).toEqual(mockSignatureResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `https://api.pinata.cloud/v3/ipfs/signature/${mockOptions.cid}`,
      {
        method: "POST",
        headers: {
          Source: "sdk/addSignature",
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
        body: JSON.stringify({ signature: mockOptions.signature }),
      },
    );
  });

  it("should throw ValidationError if config is missing", async () => {
    await expect(addSignature(undefined, mockOptions)).rejects.toThrow(ValidationError);
  });

  it("should throw ValidationError if pinataJwt is missing", async () => {
    const invalidConfig: Partial<PinataConfig> = {
      pinataGateway: "test-gateway.pinata.cloud",
    };
    await expect(
      addSignature(invalidConfig as PinataConfig, mockOptions),
    ).rejects.toThrow(ValidationError);
  });

  it("should throw AuthenticationError on 401 response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
    });

    await expect(addSignature(mockConfig, mockOptions)).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("should throw PinataError on 403 response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValueOnce({ error: "Forbidden" }),
    });

    await expect(addSignature(mockConfig, mockOptions)).rejects.toThrow(PinataError);
  });

  it("should throw NetworkError on non-401/403 error response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
    });

    await expect(addSignature(mockConfig, mockOptions)).rejects.toThrow(NetworkError);
  });

  it("should throw PinataError on fetch failure", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network failure"));

    await expect(addSignature(mockConfig, mockOptions)).rejects.toThrow(PinataError);
  });

  it("should throw PinataError on unexpected errors", async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() => {
      throw new Error("Unexpected error");
    });

    await expect(addSignature(mockConfig, mockOptions)).rejects.toThrow(PinataError);
  });
});
