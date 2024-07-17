import { getCid } from "../../src/core/gateway/getCid";
import { type PinataConfig, GetCIDResponse } from "../../src";

// Mock the gateway-tools module
jest.mock("../../src/utils/gateway-tools", () => ({
	convertToDesiredGateway: jest.fn((cid, gateway) => {
		return `${gateway}/ipfs/${cid}`;
	}),
}));

describe("getCid", () => {
	const mockConfig: PinataConfig = {
		pinataJwt: "test-jwt",
		pinataGateway: "https://mygateway.mypinata.cloud",
		pinataGatewayKey: "my-gateway-key",
	};

	const mockCid = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";

	beforeEach(() => {
		global.fetch = jest.fn();
	});

	it("should fetch JSON data", async () => {
		const mockJsonData = { key: "value" };
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			headers: new Headers({ "content-type": "application/json" }),
			json: jest.fn().mockResolvedValueOnce(mockJsonData),
		});

		const result = await getCid(mockConfig, mockCid);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://mygateway.mypinata.cloud/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG?pinataGatewayToken=my-gateway-key",
			{
				method: "GET",
				headers: {
					Authorization: "Bearer test-jwt",
				},
			},
		);
		expect(result).toEqual({
			data: mockJsonData,
			contentType: "application/json",
		});
	});

	it("should fetch text data", async () => {
		const mockTextData = "Hello, World!";
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			headers: new Headers({ "content-type": "text/plain" }),
			text: jest.fn().mockResolvedValueOnce(mockTextData),
		});

		const result = await getCid(mockConfig, mockCid);

		expect(result).toEqual({
			data: mockTextData,
			contentType: "text/plain",
		});
	});

	it("should fetch blob data", async () => {
		const mockBlobData = new Blob(["binary data"], {
			type: "application/octet-stream",
		});
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			headers: new Headers({ "content-type": "application/octet-stream" }),
			blob: jest.fn().mockResolvedValueOnce(mockBlobData),
		});

		const result = await getCid(mockConfig, mockCid);

		expect(result).toEqual({
			data: mockBlobData,
			contentType: "application/octet-stream",
		});
	});

	it("should handle URLs without a gateway key", async () => {
		const configWithoutKey: PinataConfig = {
			pinataJwt: "test-jwt",
			pinataGateway: "https://mygateway.mypinata.cloud",
		};

		const mockJsonData = { key: "value" };
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			headers: new Headers({ "content-type": "application/json" }),
			json: jest.fn().mockResolvedValueOnce(mockJsonData),
		});

		await getCid(configWithoutKey, mockCid);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://mygateway.mypinata.cloud/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
			expect.any(Object),
		);
	});

	it("should throw an error when fetch fails", async () => {
		const error = new Error("Fetch failed");
		(global.fetch as jest.Mock).mockRejectedValueOnce(error);

		await expect(getCid(mockConfig, mockCid)).rejects.toThrow("Fetch failed");
	});
});
