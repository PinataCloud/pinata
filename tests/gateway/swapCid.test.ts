import { swapCid } from "../../src/core/gateway/swapCid";
import type {
	PinataConfig,
	SwapCidOptions,
	SwapCidResponse,
} from "../../src/core/types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("swapCid function", () => {
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

	const mockOptions: SwapCidOptions = {
		cid: "QmOldCid123",
		swapCid: "QmNewCid456",
	};

	const mockSwapResponse: SwapCidResponse = {
		mappedCid: "QmNewCid456",
		createdAt: "2023-08-19T12:00:00Z",
	};

	it("should successfully swap a CID", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockSwapResponse }),
		});

		const result = await swapCid(mockConfig, mockOptions);

		expect(result).toEqual(mockSwapResponse);
		expect(global.fetch).toHaveBeenCalledWith(
			`https://api.pinata.cloud/v3/ipfs/swap/${mockOptions.cid}`,
			{
				method: "PUT",
				headers: {
					Source: "sdk/swapCid",
					"Content-Type": "application/json",
					Authorization: `Bearer ${mockConfig.pinataJwt}`,
				},
				body: JSON.stringify({ swapCid: mockOptions.swapCid }),
			},
		);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(swapCid(undefined, mockOptions)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw ValidationError if pinataJwt is missing", async () => {
		const invalidConfig: Partial<PinataConfig> = {
			pinataGateway: "test-gateway.pinata.cloud",
		};
		await expect(
			swapCid(invalidConfig as PinataConfig, mockOptions),
		).rejects.toThrow(ValidationError);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: false,
			status: 401,
			json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
		});

		await expect(swapCid(mockConfig, mockOptions)).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw PinataError on 403 response", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: false,
			status: 403,
			json: jest.fn().mockResolvedValueOnce({ error: "Forbidden" }),
		});

		await expect(swapCid(mockConfig, mockOptions)).rejects.toThrow(PinataError);
	});

	it("should throw PinataError on 404 response", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: false,
			status: 404,
			json: jest.fn().mockResolvedValueOnce({ error: "Not Found" }),
		});

		await expect(swapCid(mockConfig, mockOptions)).rejects.toThrow(PinataError);
	});

	it("should throw NetworkError on other non-successful responses", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
		});

		await expect(swapCid(mockConfig, mockOptions)).rejects.toThrow(
			NetworkError,
		);
	});

	it("should throw PinataError on fetch failure", async () => {
		(global.fetch as jest.Mock).mockRejectedValueOnce(
			new Error("Network failure"),
		);

		await expect(swapCid(mockConfig, mockOptions)).rejects.toThrow(PinataError);
	});

	it("should use custom endpoint if provided", async () => {
		const customConfig = {
			...mockConfig,
			endpointUrl: "https://custom.api.pinata.cloud",
		};

		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockSwapResponse }),
		});

		await swapCid(customConfig, mockOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			`https://custom.api.pinata.cloud/v3/ipfs/swap/${mockOptions.cid}`,
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
			json: jest.fn().mockResolvedValueOnce({ data: mockSwapResponse }),
		});

		await swapCid(customConfig, mockOptions);

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
