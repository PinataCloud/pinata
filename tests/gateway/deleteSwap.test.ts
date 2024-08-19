import { deleteSwap } from "../../src/core/gateway/deleteSwap";
import type { PinataConfig } from "../../src/core/types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("deleteSwap function", () => {
	let originalFetch: typeof global.fetch;

	beforeEach(() => {
		originalFetch = global.fetch;
		global.fetch = jest.fn();
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	const mockConfig: PinataConfig = {
		pinataJwt: "test-jwt",
		pinataGateway: "test-gateway.pinata.cloud",
	};

	const mockCid = "QmTestCid123";

	it("should successfully delete a swap", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			statusText: "OK",
		});

		const result = await deleteSwap(mockConfig, mockCid);

		expect(result).toEqual("OK");
		expect(global.fetch).toHaveBeenCalledWith(
			`https://api.pinata.cloud/v3/ipfs/swap/${mockCid}`,
			{
				method: "DELETE",
				headers: {
					Source: "sdk/deleteSwap",
					"Content-Type": "application/json",
					Authorization: `Bearer ${mockConfig.pinataJwt}`,
				},
			},
		);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(deleteSwap(undefined, mockCid)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw ValidationError if pinataJwt is missing", async () => {
		const invalidConfig: Partial<PinataConfig> = {
			pinataGateway: "test-gateway.pinata.cloud",
		};
		await expect(
			deleteSwap(invalidConfig as PinataConfig, mockCid),
		).rejects.toThrow(ValidationError);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: false,
			status: 401,
			json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
		});

		await expect(deleteSwap(mockConfig, mockCid)).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw PinataError on 403 response", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: false,
			status: 403,
			json: jest.fn().mockResolvedValueOnce({ error: "Forbidden" }),
		});

		await expect(deleteSwap(mockConfig, mockCid)).rejects.toThrow(PinataError);
	});

	it("should throw PinataError on 404 response", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: false,
			status: 404,
			json: jest.fn().mockResolvedValueOnce({ error: "Not Found" }),
		});

		await expect(deleteSwap(mockConfig, mockCid)).rejects.toThrow(PinataError);
	});

	it("should throw NetworkError on other non-successful responses", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
		});

		await expect(deleteSwap(mockConfig, mockCid)).rejects.toThrow(NetworkError);
	});

	it("should throw PinataError on fetch failure", async () => {
		(global.fetch as jest.Mock).mockRejectedValueOnce(
			new Error("Network failure"),
		);

		await expect(deleteSwap(mockConfig, mockCid)).rejects.toThrow(PinataError);
	});

	it("should use custom endpoint if provided", async () => {
		const customConfig = {
			...mockConfig,
			endpointUrl: "https://custom.api.pinata.cloud",
		};

		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			statusText: "OK",
		});

		await deleteSwap(customConfig, mockCid);

		expect(global.fetch).toHaveBeenCalledWith(
			`https://custom.api.pinata.cloud/v3/ipfs/swap/${mockCid}`,
			expect.any(Object),
		);
	});

	it("should use custom headers if provided", async () => {
		const customConfig = {
			...mockConfig,
			customHeaders: { "X-Custom-Header": "CustomValue" },
		};

		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			statusText: "OK",
		});

		await deleteSwap(customConfig, mockCid);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				headers: expect.objectContaining({
					"X-Custom-Header": "CustomValue",
				}),
			}),
		);
	});
});
