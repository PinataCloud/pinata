import { uploadFile } from "../../src/core/pinning/file";
import { toPinataMetadataAPI } from "../pinata-metadata-util"; // Adjust import path as necessary
import type {
  PinataConfig,
  UploadOptions,
  PinResponse,
  PinataMetadata,
} from "../../src";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../src/utils/custom-errors";

describe("uploadFile function", () => {
  const mockConfig: PinataConfig = {
    pinataJwt: "test-jwt",
  };

  const mockFile = new File(["test content"], "test.txt", {
    type: "text/plain",
  });

  const mockResponse: PinResponse = {
    IpfsHash: "QmTest123",
    PinSize: 123,
    Timestamp: "2023-07-26T12:00:00Z",
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should upload file successfully", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    const result = await uploadFile(mockConfig, mockFile);

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test-jwt",
        },
        body: expect.any(FormData),
      }),
    );
  });

  it("should handle upload options", async () => {
    const mockMetadata: PinataMetadata = {
      name: "Custom File Name",
      keyValues: {
        key1: "value1",
        key2: "value2",
      },
    };
    const mockOptions: UploadOptions = {
      metadata: mockMetadata,
      cidVersion: 1,
      groupId: "test-group",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    await uploadFile(mockConfig, mockFile, mockOptions);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test-jwt",
        },
        body: expect.any(FormData),
      }),
    );

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const formData = fetchCall[1].body as FormData;

    expect(JSON.parse(formData.get("pinataOptions") as string)).toEqual({
      cidVersion: mockOptions.cidVersion,
      groupId: mockOptions.groupId,
    });
    expect(JSON.parse(formData.get("pinataMetadata") as string)).toEqual(
      toPinataMetadataAPI(mockMetadata),
    );
  });

  it("should use custom JWT if provided in options", async () => {
    const customJwt = "custom-jwt";
    const mockOptions: UploadOptions = {
      keys: customJwt,
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    await uploadFile(mockConfig, mockFile, mockOptions);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      expect.objectContaining({
        headers: {
          Authorization: `Bearer ${customJwt}`,
        },
      }),
    );
  });

  it("should throw ValidationError if config is missing", async () => {
    await expect(uploadFile(undefined, mockFile)).rejects.toThrow(
      ValidationError,
    );
  });

  it("should throw AuthenticationError on 401 response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
    });

    await expect(uploadFile(mockConfig, mockFile)).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("should throw NetworkError on non-401 error response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
    });

    await expect(uploadFile(mockConfig, mockFile)).rejects.toThrow(
      NetworkError,
    );
  });

  it("should throw PinataError on fetch failure", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("Network failure"));

    await expect(uploadFile(mockConfig, mockFile)).rejects.toThrow(PinataError);
  });
});
