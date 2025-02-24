import { swapCid } from "../../src/core/functions/files/swapCid";
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
	describe("public network", () => {
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

		const mockSwapCidOptions: SwapCidOptions = {
			cid: "QmOldHash",
			swapCid: "QmNewHash",
		};

		const mockSwapCidResponse: SwapCidResponse = {
			mapped_cid: "QmNewHash",
			created_at: "2023-07-26T12:00:00Z",
		};

		it("should swap CID successfully", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockSwapCidResponse }),
			});

			const result = await swapCid(mockConfig, mockSwapCidOptions, "public");

			expect(global.fetch).toHaveBeenCalledWith(
				`https://api.pinata.cloud/v3/files/public/swap/${mockSwapCidOptions.cid}`,
				{
					method: "PUT",
					headers: {
						Authorization: `Bearer ${mockConfig.pinataJwt}`,
						"Content-Type": "application/json",
						Source: "sdk/swapCid",
					},
					body: JSON.stringify({
						swap_cid: mockSwapCidOptions.swapCid,
					}),
				},
			);
			expect(result).toEqual(mockSwapCidResponse);
		});

		it("should throw ValidationError if config is missing", async () => {
			await expect(
				swapCid(undefined, mockSwapCidOptions, "public"),
			).rejects.toThrow(ValidationError);
		});

		it("should throw AuthenticationError on 401 response", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: jest.fn().mockResolvedValueOnce("Unauthorized"),
			});

			await expect(
				swapCid(mockConfig, mockSwapCidOptions, "public"),
			).rejects.toThrow(AuthenticationError);
		});

		it("should throw NetworkError on non-401 error response", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: jest.fn().mockResolvedValueOnce("Server Error"),
			});

			await expect(
				swapCid(mockConfig, mockSwapCidOptions, "public"),
			).rejects.toThrow(NetworkError);
		});

		it("should throw PinataError on fetch failure", async () => {
			global.fetch = jest
				.fn()
				.mockRejectedValueOnce(new Error("Network failure"));

			await expect(
				swapCid(mockConfig, mockSwapCidOptions, "public"),
			).rejects.toThrow(PinataError);
		});

		it("should throw PinataError on unexpected errors", async () => {
			global.fetch = jest.fn().mockImplementationOnce(() => {
				throw new Error("Unexpected error");
			});

			await expect(
				swapCid(mockConfig, mockSwapCidOptions, "public"),
			).rejects.toThrow(PinataError);
		});

		it("should use custom endpoint if provided", async () => {
			const customConfig: PinataConfig = {
				...mockConfig,
				endpointUrl: "https://custom.api.pinata.cloud",
			};

			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockSwapCidResponse }),
			});

			await swapCid(customConfig, mockSwapCidOptions, "public");

			expect(global.fetch).toHaveBeenCalledWith(
				`https://custom.api.pinata.cloud/files/public/swap/${mockSwapCidOptions.cid}`,
				expect.any(Object),
			);
		});

		it("should use custom headers if provided", async () => {
			const customConfig: PinataConfig = {
				...mockConfig,
				customHeaders: { "X-Custom-Header": "CustomValue" },
			};

			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockSwapCidResponse }),
			});

			await swapCid(customConfig, mockSwapCidOptions, "public");

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

	describe("private network", () => {
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

		const mockSwapCidOptions: SwapCidOptions = {
			cid: "QmOldHash",
			swapCid: "QmNewHash",
		};

		const mockSwapCidResponse: SwapCidResponse = {
			mapped_cid: "QmNewHash",
			created_at: "2023-07-26T12:00:00Z",
		};

		it("should swap CID successfully", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockSwapCidResponse }),
			});

			const result = await swapCid(mockConfig, mockSwapCidOptions, "private");

			expect(global.fetch).toHaveBeenCalledWith(
				`https://api.pinata.cloud/v3/files/private/swap/${mockSwapCidOptions.cid}`,
				{
					method: "PUT",
					headers: {
						Authorization: `Bearer ${mockConfig.pinataJwt}`,
						"Content-Type": "application/json",
						Source: "sdk/swapCid",
					},
					body: JSON.stringify({
						swap_cid: mockSwapCidOptions.swapCid,
					}),
				},
			);
			expect(result).toEqual(mockSwapCidResponse);
		});

		it("should throw ValidationError if config is missing", async () => {
			await expect(
				swapCid(undefined, mockSwapCidOptions, "private"),
			).rejects.toThrow(ValidationError);
		});

		it("should throw AuthenticationError on 401 response", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: jest.fn().mockResolvedValueOnce("Unauthorized"),
			});

			await expect(
				swapCid(mockConfig, mockSwapCidOptions, "private"),
			).rejects.toThrow(AuthenticationError);
		});

		it("should throw NetworkError on non-401 error response", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: jest.fn().mockResolvedValueOnce("Server Error"),
			});

			await expect(
				swapCid(mockConfig, mockSwapCidOptions, "private"),
			).rejects.toThrow(NetworkError);
		});

		it("should throw PinataError on fetch failure", async () => {
			global.fetch = jest
				.fn()
				.mockRejectedValueOnce(new Error("Network failure"));

			await expect(
				swapCid(mockConfig, mockSwapCidOptions, "private"),
			).rejects.toThrow(PinataError);
		});

		it("should throw PinataError on unexpected errors", async () => {
			global.fetch = jest.fn().mockImplementationOnce(() => {
				throw new Error("Unexpected error");
			});

			await expect(
				swapCid(mockConfig, mockSwapCidOptions, "private"),
			).rejects.toThrow(PinataError);
		});

		it("should use custom endpoint if provided", async () => {
			const customConfig: PinataConfig = {
				...mockConfig,
				endpointUrl: "https://custom.api.pinata.cloud",
			};

			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockSwapCidResponse }),
			});

			await swapCid(customConfig, mockSwapCidOptions, "private");

			expect(global.fetch).toHaveBeenCalledWith(
				`https://custom.api.pinata.cloud/files/private/swap/${mockSwapCidOptions.cid}`,
				expect.any(Object),
			);
		});

		it("should use custom headers if provided", async () => {
			const customConfig: PinataConfig = {
				...mockConfig,
				customHeaders: { "X-Custom-Header": "CustomValue" },
			};

			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockSwapCidResponse }),
			});

			await swapCid(customConfig, mockSwapCidOptions, "private");

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
});
