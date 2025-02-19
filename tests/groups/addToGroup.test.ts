import { addToGroup } from "../../src/core/functions/groups/addToGroup";
import type { PinataConfig } from "../../src/core/types";
import { ValidationError } from "../../src/utils/custom-errors";

describe("addToGroup function", () => {
  describe("public network", () => {
    let originalFetch: typeof fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    const mockConfig: PinataConfig = {
      pinataJwt: "test_jwt"
    };

    it("should add files to group successfully", async () => {
      const mockOptions = {
        groupId: "test-group",
        files: ["test-file-1", "test-file-2"]
      };

      // Mock successful responses for both files
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          statusText: "OK"
        })
        .mockResolvedValueOnce({
          ok: true,
          statusText: "OK"
        });

      const result = await addToGroup(mockConfig, mockOptions, "public");

      expect(result).toEqual([
        { id: "test-file-1", status: "OK" },
        { id: "test-file-2", status: "OK" }
      ]);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.pinata.cloud/v3/groups/public/test-group/ids/test-file-1",
        {
          method: "PUT",
          headers: {
            Authorization: "Bearer test_jwt",
            "Content-Type": "application/json",
            Source: "sdk/addToGroup"
          }
        }
      );
    });

    it("should handle errors for individual files", async () => {
      const mockOptions = {
        groupId: "test-group",
        files: ["test-file-1", "test-file-2"]
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          statusText: "OK"
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: jest.fn().mockResolvedValue("File not found")
        });

      const result = await addToGroup(mockConfig, mockOptions, "public");

      expect(result[0].status).toBe("OK");
      expect(result[1].status).toBe("HTTP error: File not found");
    });

    it("should throw ValidationError if config is missing", async () => {
      const mockOptions = {
        groupId: "test-group",
        files: ["test-file"]
      };

      await expect(addToGroup(undefined, mockOptions, "public")).rejects.toThrow(ValidationError);
    });

    it("should handle authentication errors", async () => {
      const mockOptions = {
        groupId: "test-group",
        files: ["test-file"]
      };

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue("Unauthorized")
      });

      const result = await addToGroup(mockConfig, mockOptions, "public");
      expect(result[0].status).toBe("Authentication failed: Unauthorized");
    });
  });

  describe("private network", () => {
    let originalFetch: typeof fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    const mockConfig: PinataConfig = {
      pinataJwt: "test_jwt"
    };

    it("should add files to group successfully", async () => {
      const mockOptions = {
        groupId: "test-group",
        files: ["test-file-1", "test-file-2"]
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          statusText: "OK"
        })
        .mockResolvedValueOnce({
          ok: true,
          statusText: "OK"
        });

      const result = await addToGroup(mockConfig, mockOptions, "private");

      expect(result).toEqual([
        { id: "test-file-1", status: "OK" },
        { id: "test-file-2", status: "OK" }
      ]);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.pinata.cloud/v3/groups/private/test-group/ids/test-file-1",
        {
          method: "PUT",
          headers: {
            Authorization: "Bearer test_jwt",
            "Content-Type": "application/json",
            Source: "sdk/addToGroup"
          }
        }
      );
    });

    it("should handle errors for individual files", async () => {
      const mockOptions = {
        groupId: "test-group",
        files: ["test-file-1", "test-file-2"]
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          statusText: "OK"
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: jest.fn().mockResolvedValue("File not found")
        });

      const result = await addToGroup(mockConfig, mockOptions, "private");

      expect(result[0].status).toBe("OK");
      expect(result[1].status).toBe("HTTP error: File not found");
    });

    it("should throw ValidationError if config is missing", async () => {
      const mockOptions = {
        groupId: "test-group",
        files: ["test-file"]
      };

      await expect(addToGroup(undefined, mockOptions, "private")).rejects.toThrow(ValidationError);
    });

    it("should handle authentication errors", async () => {
      const mockOptions = {
        groupId: "test-group",
        files: ["test-file"]
      };

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue("Unauthorized")
      });

      const result = await addToGroup(mockConfig, mockOptions, "private");
      expect(result[0].status).toBe("Authentication failed: Unauthorized");
    });
  });
});
