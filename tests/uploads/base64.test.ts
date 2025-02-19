import { uploadBase64 } from "../../src/core/functions";
import type {
  PinataConfig,
  UploadOptions,
  UploadResponse,
  PinataMetadata,
} from "../../src";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../src/utils/custom-errors";

describe("uploadBase64 function", () => {
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

  const mockBase64String =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==";

  const mockResponse: UploadResponse = {
    id: "testId",
    name: "testName",
    cid: "QmTest123",
    size: 1234,
    created_at: "2023-01-01T00:00:00Z",
    number_of_files: 1,
    mime_type: "image/png",
    user_id: "testUserId",
    group_id: null,
    is_duplicate: null,
    vectorized: null
  };

  it("should upload base64 successfully to public network", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
    });

    const result = await uploadBase64(mockConfig, mockBase64String, "public");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://uploads.pinata.cloud/v3/files",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
          Source: "sdk/base64",
        },
        body: expect.any(FormData),
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it("should upload base64 successfully to private network", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
    });

    const result = await uploadBase64(mockConfig, mockBase64String, "private");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://uploads.pinata.cloud/v3/files",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
          Source: "sdk/base64",
        },
        body: expect.any(FormData),
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it("should throw ValidationError if config is missing", async () => {
    await expect(uploadBase64(undefined, mockBase64String, "public")).rejects.toThrow(
      ValidationError,
    );
  });

  it("should throw AuthenticationError on 401 response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValueOnce("Unauthorized"),
    });

    await expect(uploadBase64(mockConfig, mockBase64String, "public")).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("should throw NetworkError on non-401 error response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValueOnce("Server Error"),
    });

    await expect(uploadBase64(mockConfig, mockBase64String, "public")).rejects.toThrow(
      NetworkError,
    );
  });

  it("should handle upload options", async () => {
    const mockMetadata: PinataMetadata = {
      name: "Test File",
      keyvalues: {
        key1: "value1",
      },
    };

    const mockOptions: UploadOptions = {
      metadata: mockMetadata,
      groupId: "test-group",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    await uploadBase64(mockConfig, mockBase64String, "public", mockOptions);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://uploads.pinata.cloud/v3/files",
      expect.objectContaining({
        body: expect.any(FormData),
      }),
    );

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const formData = fetchCall[1].body as FormData;

    expect(formData.get("name")).toBe(mockMetadata.name);
    expect(formData.get("group_id")).toBe(mockOptions.groupId);
    expect(formData.get("keyvalues")).toBe(JSON.stringify({ key1: "value1" }));
  });

  it("should use custom JWT if provided in options", async () => {
    const customJwt = "custom_jwt_token";
    const mockOptions: UploadOptions = {
      keys: customJwt,
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    await uploadBase64(mockConfig, mockBase64String, "public", mockOptions);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://uploads.pinata.cloud/v3/files",
      expect.objectContaining({
        headers: {
          Source: "sdk/base64",
          Authorization: `Bearer ${customJwt}`,
        },
      }),
    );
  });
});
