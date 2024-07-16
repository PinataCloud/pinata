import { updateMetadata } from "../../src/core/data/updateMetadata";
import { PinataConfig, PinataMetadataUpdate } from "../../src";

describe("updateMetadata", () => {
  const mockConfig: PinataConfig = {
    pinataJwt: "test-jwt",
  };

  const mockOptions: PinataMetadataUpdate = {
    cid: "Qm...1",
    name: "Updated File Name",
    keyValues: {
      key1: "value1",
      key2: "value2",
    },
  };

  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should update metadata successfully", async () => {
    const mockResponse = "Metadata updated successfully";

    global.fetch = jest.fn().mockResolvedValue({
      text: jest.fn().mockResolvedValue(mockResponse),
    } as unknown as Response);

    const result = await updateMetadata(mockConfig, mockOptions);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/pinning/hashMetadata",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-jwt",
        },
        body: JSON.stringify({
          ipfsPinHash: mockOptions.cid,
          name: mockOptions.name,
          keyvalues: mockOptions.keyValues,
        }),
      },
    );
    expect(result).toEqual(mockResponse);
  });

  it("should handle errors", async () => {
    const error = new Error("API error");
    global.fetch = jest.fn().mockRejectedValue(error);

    await expect(updateMetadata(mockConfig, mockOptions)).rejects.toThrow(
      "API error",
    );
  });

  it("should update metadata with only CID", async () => {
    const mockResponse = "Metadata updated successfully";
    const minimalOptions: PinataMetadataUpdate = { cid: "Qm...1" };

    global.fetch = jest.fn().mockResolvedValue({
      text: jest.fn().mockResolvedValue(mockResponse),
    } as unknown as Response);

    await updateMetadata(mockConfig, minimalOptions);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/pinning/hashMetadata",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-jwt",
        },
        body: JSON.stringify({
          ipfsPinHash: minimalOptions.cid,
        }),
      },
    );
  });
});
