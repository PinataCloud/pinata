import { uploadUrl } from "../../src/core/functions";
import type {
  PinataConfig,
  UploadOptions,
  UploadResponse,
  PinataMetadata,
} from "../../src/core/types";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../src/utils/custom-errors";

describe("uploadUrl function", () => {
  const mockConfig: PinataConfig = {
    pinataJwt: "test-jwt",
  };

  const mockUrl = "https://example.com/image.jpg";

  const mockResponse: UploadResponse = {
    id: "test-id",
    name: "test-name",
    cid: "QmTest123",
    size: 12345,
    created_at: "2023-04-01T12:00:00Z",
    number_of_files: 1,
    mime_type: "image/jpeg",
    user_id: "test-user-id",
    group_id: null,
    is_duplicate: null,
    vectorized: null
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should upload URL to public network successfully", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValueOnce(new ArrayBuffer(8)),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
      });

    const result = await uploadUrl(mockConfig, mockUrl, "public");

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(1, mockUrl);
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "https://uploads.pinata.cloud/v3/files",
      expect.objectContaining({
        method: "POST",
        headers: {
          Source: "sdk/url",
          Authorization: "Bearer test-jwt",
        },
        body: expect.any(FormData),
      }),
    );
  });

  it("should upload URL to private network successfully", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValueOnce(new ArrayBuffer(8)),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
      });

    const result = await uploadUrl(mockConfig, mockUrl, "private");

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const formData = (global.fetch as jest.Mock).mock.calls[1][1].body;
    expect(formData.get("network")).toBe("private");
  });

  it("should handle upload options", async () => {
    const mockMetadata: PinataMetadata = {
      name: "Custom URL Name",
      keyvalues: {
        key1: "value1",
      },
    };
    const mockOptions: UploadOptions = {
      metadata: mockMetadata,
      groupId: "test-group",
    };

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValueOnce(new ArrayBuffer(8)),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
      });

    await uploadUrl(mockConfig, mockUrl, "public", mockOptions);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const formData = (global.fetch as jest.Mock).mock.calls[1][1].body;

    expect(formData.get("name")).toBe("Custom URL Name");
    expect(formData.get("group_id")).toBe("test-group");
    expect(formData.get("keyvalues")).toBe(JSON.stringify({ key1: "value1" }));
  });

  it("should use custom JWT if provided in options", async () => {
    const customJwt = "custom-jwt";
    const mockOptions: UploadOptions = {
      keys: customJwt,
    };

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValueOnce(new ArrayBuffer(8)),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
      });

    await uploadUrl(mockConfig, mockUrl, "public", mockOptions);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "https://uploads.pinata.cloud/v3/files",
      expect.objectContaining({
        headers: {
          Source: "sdk/url",
          Authorization: `Bearer ${customJwt}`,
        },
      }),
    );
  });

  it("should use default name if not provided", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValueOnce(new ArrayBuffer(8)),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
      });

    await uploadUrl(mockConfig, mockUrl, "public");

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const formData = (global.fetch as jest.Mock).mock.calls[1][1].body;
    expect(formData.get("name")).toBe("url_upload");
  });

  it("should throw ValidationError if config is missing", async () => {
    await expect(uploadUrl(undefined, mockUrl, "public")).rejects.toThrow(
      ValidationError,
    );
  });

  it("should throw NetworkError if fetching URL fails", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: jest.fn().mockResolvedValueOnce("Not Found"),
    });

    await expect(uploadUrl(mockConfig, mockUrl, "public")).rejects.toThrow(NetworkError);
  });

  it("should throw AuthenticationError on 401 response from Pinata", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValueOnce(new ArrayBuffer(8)),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValueOnce("Unauthorized"),
      });

    await expect(uploadUrl(mockConfig, mockUrl, "public")).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("should throw NetworkError on non-401 error response from Pinata", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValueOnce(new ArrayBuffer(8)),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValueOnce("Server Error"),
      });

    await expect(uploadUrl(mockConfig, mockUrl, "public")).rejects.toThrow(NetworkError);
  });
});
