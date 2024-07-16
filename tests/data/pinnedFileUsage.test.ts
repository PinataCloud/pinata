import { pinnedFileCount } from "../../src/core/data/pinnedFileUsage";
import { PinataConfig } from "../../src";

describe("pinnedFileCount", () => {
  const mockConfig: PinataConfig = {
    pinataJwt: "test-jwt",
  };

  const mockResponse = {
    pin_count: 100,
    pin_size_total: 1000000,
    pin_size_with_replications_total: 2000000,
  };

  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should fetch pinned file count", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockResponse),
    } as unknown as Response);

    const result = await pinnedFileCount(mockConfig);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/data/userPinnedDataTotal",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer test-jwt",
        },
      },
    );
    expect(result).toEqual(mockResponse.pin_count);
  });

  it("should handle errors", async () => {
    const error = new Error("API error");
    global.fetch = jest.fn().mockRejectedValue(error);

    await expect(pinnedFileCount(mockConfig)).rejects.toThrow("API error");
  });
});
