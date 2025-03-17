import { deletePinRequest } from "../../src/core/functions/files/deletePinRequest";
import type { PinataConfig } from "../../src/core/types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("deletePinRequest function", () => {
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

	it("should delete pin request successfully", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce("OK"),
		});

		const result = await deletePinRequest(mockConfig, "test-id");

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/v3/files/public/pin_by_cid/test-id",
			{
				method: "DELETE",
				headers: {
					Source: "sdk/deletePinRequest",
					Authorization: `Bearer ${mockConfig.pinataJwt}`,
				},
			},
		);
		expect(result).toEqual("OK");
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(deletePinRequest(undefined, "test-id")).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			text: jest.fn().mockResolvedValueOnce("Unauthorized"),
		});

		await expect(deletePinRequest(mockConfig, "test-id")).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			text: jest.fn().mockResolvedValueOnce("Server Error"),
		});

		await expect(deletePinRequest(mockConfig, "test-id")).rejects.toThrow(
			NetworkError,
		);
	});

	it("should throw PinataError on fetch failure", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValueOnce(new Error("Network failure"));

		await expect(deletePinRequest(mockConfig, "test-id")).rejects.toThrow(
			PinataError,
		);
	});

	it("should use custom endpoint if provided", async () => {
		const customConfig: PinataConfig = {
			...mockConfig,
			endpointUrl: "https://custom.api.pinata.cloud",
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce("OK"),
		});

		await deletePinRequest(customConfig, "test-id");

		expect(global.fetch).toHaveBeenCalledWith(
			"https://custom.api.pinata.cloud/files/public/pin_by_cid/test-id",
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
			json: jest.fn().mockResolvedValueOnce("OK"),
		});

		await deletePinRequest(customConfig, "test-id");

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
