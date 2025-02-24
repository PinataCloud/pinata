import { swapHistory } from "../../src/core/functions/files/swapHistory";
import type {
	PinataConfig,
	SwapHistoryOptions,
	SwapCidResponse,
} from "../../src/core/types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("swapHistory function", () => {
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

		const mockSwapResponse: SwapCidResponse = {
			mapped_cid: "QmNewHash",
			created_at: "2023-07-26T12:00:00Z",
		};

		it("should get swap history successfully", async () => {
			const mockResponse: SwapCidResponse[] = [mockSwapResponse];
			const mockOptions: SwapHistoryOptions = {
				cid: "QmHash",
				domain: "test.pinata.cloud",
			};

			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
			});

			const result = await swapHistory(mockConfig, mockOptions, "public");

			expect(global.fetch).toHaveBeenCalledWith(
				`https://api.pinata.cloud/v3/files/public/swap/${mockOptions.cid}?domain=${mockOptions.domain}`,
				{
					method: "GET",
					headers: {
						Authorization: `Bearer ${mockConfig.pinataJwt}`,
						"Content-Type": "application/json",
						Source: "sdk/swapHistory",
					},
				},
			);
			expect(result).toEqual(mockResponse);
		});

		it("should throw ValidationError if config is missing", async () => {
			const mockOptions: SwapHistoryOptions = {
				cid: "QmHash",
				domain: "test.pinata.cloud",
			};
			await expect(
				swapHistory(undefined, mockOptions, "public"),
			).rejects.toThrow(ValidationError);
		});

		it("should throw AuthenticationError on 401 response", async () => {
			const mockOptions: SwapHistoryOptions = {
				cid: "QmHash",
				domain: "test.pinata.cloud",
			};
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: jest.fn().mockResolvedValueOnce("Unauthorized"),
			});

			await expect(
				swapHistory(mockConfig, mockOptions, "public"),
			).rejects.toThrow(AuthenticationError);
		});

		it("should throw NetworkError on 404 response", async () => {
			const mockOptions: SwapHistoryOptions = {
				cid: "QmHash",
				domain: "test.pinata.cloud",
			};
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 404,
				text: jest.fn().mockResolvedValueOnce("Not Found"),
			});

			await expect(
				swapHistory(mockConfig, mockOptions, "public"),
			).rejects.toThrow(PinataError);
		});

		it("should throw NetworkError on non-401/404 error response", async () => {
			const mockOptions: SwapHistoryOptions = {
				cid: "QmHash",
				domain: "test.pinata.cloud",
			};
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: jest.fn().mockResolvedValueOnce("Server Error"),
			});

			await expect(
				swapHistory(mockConfig, mockOptions, "public"),
			).rejects.toThrow(NetworkError);
		});

		it("should throw PinataError on fetch failure", async () => {
			const mockOptions: SwapHistoryOptions = {
				cid: "QmHash",
				domain: "test.pinata.cloud",
			};
			global.fetch = jest
				.fn()
				.mockRejectedValueOnce(new Error("Network failure"));

			await expect(
				swapHistory(mockConfig, mockOptions, "public"),
			).rejects.toThrow(PinataError);
		});

		it("should use custom endpoint if provided", async () => {
			const customConfig: PinataConfig = {
				...mockConfig,
				endpointUrl: "https://custom.api.pinata.cloud",
			};

			const mockOptions: SwapHistoryOptions = {
				cid: "QmHash",
				domain: "test.pinata.cloud",
			};

			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: [mockSwapResponse] }),
			});

			await swapHistory(customConfig, mockOptions, "public");

			expect(global.fetch).toHaveBeenCalledWith(
				`https://custom.api.pinata.cloud/files/public/swap/${mockOptions.cid}?domain=${mockOptions.domain}`,
				expect.any(Object),
			);
		});

		it("should use custom headers if provided", async () => {
			const customConfig: PinataConfig = {
				...mockConfig,
				customHeaders: { "X-Custom-Header": "CustomValue" },
			};

			const mockOptions: SwapHistoryOptions = {
				cid: "QmHash",
				domain: "test.pinata.cloud",
			};

			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: [mockSwapResponse] }),
			});

			await swapHistory(customConfig, mockOptions, "public");

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

		const mockSwapResponse: SwapCidResponse = {
			mapped_cid: "QmNewHash",
			created_at: "2023-07-26T12:00:00Z",
		};

		it("should get swap history successfully", async () => {
			const mockResponse: SwapCidResponse[] = [mockSwapResponse];
			const mockOptions: SwapHistoryOptions = {
				cid: "QmHash",
				domain: "test.pinata.cloud",
			};

			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
			});

			const result = await swapHistory(mockConfig, mockOptions, "private");

			expect(global.fetch).toHaveBeenCalledWith(
				`https://api.pinata.cloud/v3/files/private/swap/${mockOptions.cid}?domain=${mockOptions.domain}`,
				{
					method: "GET",
					headers: {
						Authorization: `Bearer ${mockConfig.pinataJwt}`,
						"Content-Type": "application/json",
						Source: "sdk/swapHistory",
					},
				},
			);
			expect(result).toEqual(mockResponse);
		});

		it("should throw ValidationError if config is missing", async () => {
			const mockOptions: SwapHistoryOptions = {
				cid: "QmHash",
				domain: "test.pinata.cloud",
			};
			await expect(
				swapHistory(undefined, mockOptions, "private"),
			).rejects.toThrow(ValidationError);
		});

		it("should throw AuthenticationError on 401 response", async () => {
			const mockOptions: SwapHistoryOptions = {
				cid: "QmHash",
				domain: "test.pinata.cloud",
			};
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: jest.fn().mockResolvedValueOnce("Unauthorized"),
			});

			await expect(
				swapHistory(mockConfig, mockOptions, "private"),
			).rejects.toThrow(AuthenticationError);
		});

		it("should throw NetworkError on 404 response", async () => {
			const mockOptions: SwapHistoryOptions = {
				cid: "QmHash",
				domain: "test.pinata.cloud",
			};
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 404,
				text: jest.fn().mockResolvedValueOnce("Not Found"),
			});

			await expect(
				swapHistory(mockConfig, mockOptions, "private"),
			).rejects.toThrow(PinataError);
		});

		it("should throw NetworkError on non-401/404 error response", async () => {
			const mockOptions: SwapHistoryOptions = {
				cid: "QmHash",
				domain: "test.pinata.cloud",
			};
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: jest.fn().mockResolvedValueOnce("Server Error"),
			});

			await expect(
				swapHistory(mockConfig, mockOptions, "private"),
			).rejects.toThrow(NetworkError);
		});

		it("should throw PinataError on fetch failure", async () => {
			const mockOptions: SwapHistoryOptions = {
				cid: "QmHash",
				domain: "test.pinata.cloud",
			};
			global.fetch = jest
				.fn()
				.mockRejectedValueOnce(new Error("Network failure"));

			await expect(
				swapHistory(mockConfig, mockOptions, "private"),
			).rejects.toThrow(PinataError);
		});

		it("should use custom endpoint if provided", async () => {
			const customConfig: PinataConfig = {
				...mockConfig,
				endpointUrl: "https://custom.api.pinata.cloud",
			};

			const mockOptions: SwapHistoryOptions = {
				cid: "QmHash",
				domain: "test.pinata.cloud",
			};

			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: [mockSwapResponse] }),
			});

			await swapHistory(customConfig, mockOptions, "private");

			expect(global.fetch).toHaveBeenCalledWith(
				`https://custom.api.pinata.cloud/files/private/swap/${mockOptions.cid}?domain=${mockOptions.domain}`,
				expect.any(Object),
			);
		});

		it("should use custom headers if provided", async () => {
			const customConfig: PinataConfig = {
				...mockConfig,
				customHeaders: { "X-Custom-Header": "CustomValue" },
			};

			const mockOptions: SwapHistoryOptions = {
				cid: "QmHash",
				domain: "test.pinata.cloud",
			};

			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: [mockSwapResponse] }),
			});

			await swapHistory(customConfig, mockOptions, "private");

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
