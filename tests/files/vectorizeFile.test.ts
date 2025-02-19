import { vectorizeFile } from "../../src/core/functions/files/vectorizeFile";
import { PinataConfig, VectorizeFileResponse } from "../../src/core/types";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../src/utils/custom-errors";

describe("vectorizeFile function", () => {
  let originalFetch: typeof fetch;
  const mockConfig: PinataConfig = {
    pinataJwt: "test_jwt",
    pinataGateway: "test.cloud",
  };

  const mockResponse: VectorizeFileResponse = {
    status: true,
  };

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should vectorize file successfully", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    const result = await vectorizeFile(mockConfig, "test-file-id");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://uploads.pinata.cloud/v3/vectorize/files/test-file-id",
      {
        method: "POST",
        headers: {
          Source: "sdk/vectorizeFile",
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
      },
    );
    expect(result).toEqual(mockResponse);
  });

  it("should throw ValidationError if config is missing", async () => {
    await expect(vectorizeFile(undefined, "test-file-id")).rejects.toThrow(
      ValidationError,
    );
  });

  it("should throw AuthenticationError on 401 response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValueOnce("Unauthorized"),
    });

    await expect(vectorizeFile(mockConfig, "test-file-id")).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("should throw NetworkError on non-401 error response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValueOnce("Server Error"),
    });

    await expect(vectorizeFile(mockConfig, "test-file-id")).rejects.toThrow(
      NetworkError,
    );
  });

  it("should throw PinataError on fetch failure", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("Network failure"));

    await expect(vectorizeFile(mockConfig, "test-file-id")).rejects.toThrow(
      PinataError,
    );
  });

  it("should throw PinataError on unexpected errors", async () => {
    global.fetch = jest.fn().mockImplementationOnce(() => {
      throw new Error("Unexpected error");
    });

    await expect(vectorizeFile(mockConfig, "test-file-id")).rejects.toThrow(
      PinataError,
    );
  });

  it("should use custom endpoint if provided", async () => {
    const customConfig: PinataConfig = {
      ...mockConfig,
      uploadUrl: "https://custom.pinata.cloud",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    await vectorizeFile(customConfig, "test-file-id");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://custom.pinata.cloud/vectorize/files/test-file-id",
      expect.any(Object),
    );
  });

  it("should use custom headers if provided", async () => {
    const customConfig: PinataConfig = {
      ...mockConfig,
      customHeaders: { "X-Custom-Header": "CustomValue" },
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    await vectorizeFile(customConfig, "test-file-id");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Custom-Header": "CustomValue",
        }),
      }),
    );
  });
});
