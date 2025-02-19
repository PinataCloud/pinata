import { deleteFileVectors } from "../../src/core/functions/files/deleteFileVectors";
import { PinataConfig, VectorizeFileResponse } from "../../src/core/types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("deleteFileVectors function", () => {
	let originalFetch: typeof fetch;
	const mockConfig: PinataConfig = {
		pinataJwt: "test_jwt",
		pinataGateway: "test.cloud",
	};

	const mockResponse: VectorizeFileResponse = {
		status: true,
	};

	beforeEach(() => {
		originalFetch = global.fetch;
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it("should delete file vectors successfully", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		const result = await deleteFileVectors(mockConfig, "test-file-id");

		expect(global.fetch).toHaveBeenCalledWith(
			"https://uploads.pinata.cloud/v3/vectorize/files/test-file-id",
			{
				method: "DELETE",
				headers: {
					Source: "sdk/vectorizeFile",
					Authorization: `Bearer ${mockConfig.pinataJwt}`,
				},
			},
		);
		expect(result).toEqual(mockResponse);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(deleteFileVectors(undefined, "test-file-id")).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			text: jest.fn().mockResolvedValueOnce("Unauthorized"),
		});

		await expect(deleteFileVectors(mockConfig, "test-file-id")).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			text: jest.fn().mockResolvedValueOnce("Server Error"),
		});

		await expect(deleteFileVectors(mockConfig, "test-file-id")).rejects.toThrow(
			NetworkError,
		);
	});

	it("should throw PinataError on fetch failure", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValueOnce(new Error("Network failure"));

		await expect(deleteFileVectors(mockConfig, "test-file-id")).rejects.toThrow(
			PinataError,
		);
	});

	it("should throw PinataError on unexpected errors", async () => {
		global.fetch = jest.fn().mockImplementationOnce(() => {
			throw new Error("Unexpected error");
		});

		await expect(deleteFileVectors(mockConfig, "test-file-id")).rejects.toThrow(
			PinataError,
		);
	});

	it("should use custom endpoint if provided", async () => {
		const customConfig: PinataConfig = {
			...mockConfig,
			uploadUrl: "https://custom.uploads.pinata.cloud",
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		await deleteFileVectors(customConfig, "test-file-id");

		expect(global.fetch).toHaveBeenCalledWith(
			"https://custom.uploads.pinata.cloud/vectorize/files/test-file-id",
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
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		await deleteFileVectors(customConfig, "test-file-id");

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
