import { uploadJson } from "../../src/core/pinning/json";
import { toPinataMetadataAPI } from "../pinata-metadata-util"; // Adjust import path as necessary
import type {
  PinataConfig,
  UploadOptions,
  PinResponse,
  PinataMetadata,
  JsonBody,
} from "../../src";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../src/utils/custom-errors";

describe("uploadJson function", () => {
  const mockConfig: PinataConfig = {
    pinataJwt: "test-jwt",
  };

  const mockJsonData: JsonBody = {
    key1: "value1",
    key2: 2,
    key3: {
      nestedKey: "nestedValue",
    },
  };

  const mockResponse: PinResponse = {
    IpfsHash: "QmTest123",
    PinSize: 123,
    Timestamp: "2023-07-26T12:00:00Z",
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should upload JSON successfully", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    const result = await uploadJson(mockConfig, mockJsonData);

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      expect.objectContaining({
        method: "POST",
        headers: {
          Source: "sdk/json",
          "Content-Type": "application/json",
          Authorization: "Bearer test-jwt",
        },
        body: expect.any(String),
      }),
    );

    const requestBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(requestBody.pinataContent).toEqual(mockJsonData);
  });

  it("should handle upload options", async () => {
    const mockMetadata: PinataMetadata = {
      name: "Custom JSON Name",
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

    await uploadJson(mockConfig, mockJsonData, mockOptions);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      expect.objectContaining({
        method: "POST",
        headers: {
          Source: "sdk/json",
          "Content-Type": "application/json",
          Authorization: "Bearer test-jwt",
        },
        body: expect.any(String),
      }),
    );

    const requestBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(requestBody.pinataOptions).toEqual({
      cidVersion: mockOptions.cidVersion,
      groupId: mockOptions.groupId,
    });
    expect(requestBody.pinataMetadata).toEqual(toPinataMetadataAPI(mockMetadata));
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

    await uploadJson(mockConfig, mockJsonData, mockOptions);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      expect.objectContaining({
        headers: {
          Source: "sdk/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${customJwt}`,
        },
      }),
    );
  });

  it("should use default name if not provided", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    await uploadJson(mockConfig, mockJsonData);

    const requestBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(requestBody.pinataMetadata.name).toBe("json");
  });

  it("should throw ValidationError if config is missing", async () => {
    await expect(uploadJson(undefined, mockJsonData)).rejects.toThrow(ValidationError);
  });

  it("should throw AuthenticationError on 401 response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
    });

    await expect(uploadJson(mockConfig, mockJsonData)).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("should throw NetworkError on non-401 error response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
    });

    await expect(uploadJson(mockConfig, mockJsonData)).rejects.toThrow(NetworkError);
  });

  it("should throw PinataError on fetch failure", async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("Network failure"));

    await expect(uploadJson(mockConfig, mockJsonData)).rejects.toThrow(PinataError);
  });
});
