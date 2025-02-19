import { deleteSwap } from "../../src/core/functions/files/deleteSwap";
import type { PinataConfig } from "../../src/core/types";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../src/utils/custom-errors";

describe('deleteSwap function', () => {
  describe('public network', () => {
    let originalFetch: typeof fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    const mockConfig: PinataConfig = {
      pinataJwt: "test_jwt",
      pinataGateway: "test.cloud",
    };

    it('should delete swap successfully', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        statusText: "OK"
      });

      const result = await deleteSwap(mockConfig, "test-cid", "public");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.pinata.cloud/v3/files/public/swap/test-cid",
        {
          method: "DELETE",
          headers: {
            Authorization: "Bearer test_jwt",
            "Content-Type": "application/json",
            Source: "sdk/deleteSwap",
          },
        }
      );
      expect(result).toBe("OK");
    });

    it('should throw ValidationError if config is missing', async () => {
      await expect(deleteSwap(undefined, "test-cid", "public")).rejects.toThrow(ValidationError);
    });

    it('should throw AuthenticationError on 401 response', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValueOnce("Unauthorized"),
      });

      await expect(deleteSwap(mockConfig, "test-cid", "public")).rejects.toThrow(AuthenticationError);
    });

    it('should throw NetworkError on non-401 error response', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValueOnce("Server Error"),
      });

      await expect(deleteSwap(mockConfig, "test-cid", "public")).rejects.toThrow(NetworkError);
    });

    it('should use custom endpoint if provided', async () => {
      const customConfig = {
        ...mockConfig,
        endpointUrl: "https://custom.api.com",
      };

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        statusText: "OK"
      });

      await deleteSwap(customConfig, "test-cid", "public");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://custom.api.com/files/public/swap/test-cid",
        expect.any(Object)
      );
    });

    it('should use custom headers if provided', async () => {
      const customConfig = {
        ...mockConfig,
        customHeaders: { "X-Custom-Header": "test" },
      };

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        statusText: "OK"
      });

      await deleteSwap(customConfig, "test-cid", "public");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Custom-Header": "test",
          }),
        })
      );
    });
  });

  describe('private network', () => {
    let originalFetch: typeof fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    const mockConfig: PinataConfig = {
      pinataJwt: "test_jwt",
      pinataGateway: "test.cloud",
    };

    it('should delete swap successfully', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        statusText: "OK"
      });

      const result = await deleteSwap(mockConfig, "test-cid", "private");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.pinata.cloud/v3/files/private/swap/test-cid",
        {
          method: "DELETE",
          headers: {
            Authorization: "Bearer test_jwt",
            "Content-Type": "application/json",
            Source: "sdk/deleteSwap",
          },
        }
      );
      expect(result).toBe("OK");
    });

    it('should throw ValidationError if config is missing', async () => {
      await expect(deleteSwap(undefined, "test-cid", "private")).rejects.toThrow(ValidationError);
    });

    it('should throw AuthenticationError on 401 response', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValueOnce("Unauthorized"),
      });

      await expect(deleteSwap(mockConfig, "test-cid", "private")).rejects.toThrow(AuthenticationError);
    });

    it('should throw NetworkError on non-401 error response', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValueOnce("Server Error"),
      });

      await expect(deleteSwap(mockConfig, "test-cid", "private")).rejects.toThrow(NetworkError);
    });

    it('should use custom endpoint if provided', async () => {
      const customConfig = {
        ...mockConfig,
        endpointUrl: "https://custom.api.com",
      };

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        statusText: "OK"
      });

      await deleteSwap(customConfig, "test-cid", "private");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://custom.api.com/files/private/swap/test-cid",
        expect.any(Object)
      );
    });

    it('should use custom headers if provided', async () => {
      const customConfig = {
        ...mockConfig,
        customHeaders: { "X-Custom-Header": "test" },
      };

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        statusText: "OK"
      });

      await deleteSwap(customConfig, "test-cid", "private");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Custom-Header": "test",
          }),
        })
      );
    });
  });
});
