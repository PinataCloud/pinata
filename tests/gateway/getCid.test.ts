import { getCid } from "../../src/core/gateway/getCid";
import type { PinataConfig, GetCIDResponse } from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

// Mock the entire gateway-tools module
jest.mock("../../src/utils/gateway-tools", () => ({
	convertToDesiredGateway: jest.fn((sourceUrl, desiredGatewayPrefix) => {
		// Simple mock implementation
		return `${desiredGatewayPrefix}/ipfs/${sourceUrl.split("/").pop()}`;
	}),
}));

describe("getCid function", () => {
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
		pinataGatewayKey: "test_gateway_key",
	};

	it("should retrieve JSON data successfully", async () => {
		const mockResponse = { key: "value" };
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ "content-type": "application/json" }),
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		const result = await getCid(mockConfig, "QmTest...");

		expect(result).toEqual({
			data: mockResponse,
			contentType: "application/json",
		});
	});

	it("should retrieve text data successfully", async () => {
		const mockResponse = "Hello, world!";
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ "content-type": "text/plain" }),
			text: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		const result = await getCid(mockConfig, "QmTest...");

		expect(result).toEqual({
			data: mockResponse,
			contentType: "text/plain",
		});
	});

	it("should retrieve blob data successfully", async () => {
		const mockBlob = new Blob(["test data"], {
			type: "application/octet-stream",
		});
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ "content-type": "application/octet-stream" }),
			blob: jest.fn().mockResolvedValueOnce(mockBlob),
		});

		const result = await getCid(mockConfig, "QmTest...");

		expect(result).toEqual({
			data: mockBlob,
			contentType: "application/octet-stream",
		});
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(getCid(undefined, "QmTest...")).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
		});

		await expect(getCid(mockConfig, "QmTest...")).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
		});

		await expect(getCid(mockConfig, "QmTest...")).rejects.toThrow(NetworkError);
	});

	it("should throw PinataError on unexpected errors", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValueOnce(new Error("Unexpected error"));

		await expect(getCid(mockConfig, "QmTest...")).rejects.toThrow(PinataError);
	});

	it("should use the correct URL with gateway and token", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ "content-type": "text/plain" }),
			text: jest.fn().mockResolvedValueOnce("test"),
		});

		await getCid(mockConfig, "QmTest...");

		expect(global.fetch).toHaveBeenCalledWith(
			"https://test.mypinata.cloud/ipfs/QmTest...?pinataGatewayToken=test_gateway_key",
		);
	});
});
