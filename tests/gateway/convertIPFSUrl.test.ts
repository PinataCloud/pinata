import { convertIPFSUrl } from "../../src/core/gateway/convertIPFSUrl";
import { PinataConfig } from "../../src";

// Mock the gateway-tools module
jest.mock("../../src/utils/gateway-tools", () => ({
  convertToDesiredGateway: jest.fn((url, gateway) => {
    if (url.includes("Qm")) {
      return `${gateway}/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG`;
    }
    throw new Error("url does not contain CID");
  }),
}));

describe("convertIPFSUrl", () => {
  const mockConfig: PinataConfig = {
    pinataJwt: "test-jwt",
    pinataGateway: "https://mygateway.mypinata.cloud",
    pinataGatewayKey: "my-gateway-key",
  };

  it("should convert IPFS URL with CID", () => {
    const inputUrl = "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
    const expectedUrl =
      "https://mygateway.mypinata.cloud/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";

    const result = convertIPFSUrl(mockConfig, inputUrl);

    expect(result).toEqual(expectedUrl);
  });

  it("should convert HTTP URL with /ipfs/ path", () => {
    const inputUrl =
      "https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
    const expectedUrl =
      "https://mygateway.mypinata.cloud/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";

    const result = convertIPFSUrl(mockConfig, inputUrl);

    expect(result).toEqual(expectedUrl);
  });

  it("should convert URL with CID in subdomain", () => {
    const inputUrl =
      "https://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG.ipfs.dweb.link";
    const expectedUrl =
      "https://mygateway.mypinata.cloud/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";

    const result = convertIPFSUrl(mockConfig, inputUrl);

    expect(result).toEqual(expectedUrl);
  });

  it("should handle URLs without a gateway key", () => {
    const configWithoutKey: PinataConfig = {
      pinataJwt: "test-jwt",
      pinataGateway: "https://mygateway.mypinata.cloud",
    };
    const inputUrl = "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
    const expectedUrl =
      "https://mygateway.mypinata.cloud/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";

    const result = convertIPFSUrl(configWithoutKey, inputUrl);

    expect(result).toEqual(expectedUrl);
  });

  it("should throw an error for invalid IPFS URLs", () => {
    const invalidUrl = "https://example.com/not-an-ipfs-url";

    expect(() => convertIPFSUrl(mockConfig, invalidUrl)).toThrow(
      "url does not contain CID",
    );
  });

  it("should not append gateway key to URL", () => {
    const inputUrl = "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
    const expectedUrl =
      "https://mygateway.mypinata.cloud/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";

    const result = convertIPFSUrl(mockConfig, inputUrl);

    expect(result).toEqual(expectedUrl);
    expect(result).not.toContain("pinataGatewayToken");
  });
});
