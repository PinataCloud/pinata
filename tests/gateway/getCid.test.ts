import { getCid } from "../../src/core/gateway/getCid";
import type {
	PinataConfig,
	GetCIDResponse,
	OptimizeImageOptions,
} from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

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
	};

	it("should retrieve JSON data successfully", async () => {
		const mockResponse = { key: "value" };
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				json: jest.fn().mockResolvedValueOnce({ data: "signed_url" }),
			})
			.mockResolvedValueOnce({
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
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				json: jest.fn().mockResolvedValueOnce({ data: "signed_url" }),
			})
			.mockResolvedValueOnce({
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
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				json: jest.fn().mockResolvedValueOnce({ data: "signed_url" }),
			})
			.mockResolvedValueOnce({
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
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				json: jest.fn().mockResolvedValueOnce({ data: "signed_url" }),
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: jest.fn().mockResolvedValueOnce("Unauthorized"),
			});

		await expect(getCid(mockConfig, "QmTest...")).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				json: jest.fn().mockResolvedValueOnce({ data: "signed_url" }),
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: jest.fn().mockResolvedValueOnce("Server Error"),
			});

		await expect(getCid(mockConfig, "QmTest...")).rejects.toThrow(NetworkError);
	});

	it("should throw PinataError on unexpected errors", async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				json: jest.fn().mockResolvedValueOnce({ data: "signed_url" }),
			})
			.mockRejectedValueOnce(new Error("Unexpected error"));

		await expect(getCid(mockConfig, "QmTest...")).rejects.toThrow(PinataError);
	});

	it("should use the correct URL with gateway", async () => {
		const mockSignedUrl = "https://test.mypinata.cloud/signed_url";
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				json: jest.fn().mockResolvedValueOnce({ data: mockSignedUrl }),
			})
			.mockResolvedValueOnce({
				ok: true,
				headers: new Headers({ "content-type": "text/plain" }),
				text: jest.fn().mockResolvedValueOnce("test"),
			});

		await getCid(mockConfig, "QmTest...");

		expect(global.fetch).toHaveBeenNthCalledWith(2, mockSignedUrl);
	});

	it("should apply image optimization options", async () => {
		const mockBlob = new Blob(["optimized image data"], { type: "image/webp" });
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				json: jest.fn().mockResolvedValueOnce({ data: "signed_url" }),
			})
			.mockResolvedValueOnce({
				ok: true,
				headers: new Headers({ "content-type": "image/webp" }),
				blob: jest.fn().mockResolvedValueOnce(mockBlob),
			});

		const result = await getCid(mockConfig, "QmTest...", {
			width: 100,
			height: 100,
			quality: 80,
			format: "webp",
		});

		expect(result).toEqual({
			data: mockBlob,
			contentType: "image/webp",
		});

		expect(global.fetch).toHaveBeenNthCalledWith(
			1,
			"https://api.pinata.cloud/v3/files/sign",
			expect.objectContaining({
				body: expect.stringContaining(
					"img-width=100&img-height=100&img-quality=80&img-format=webp",
				),
			}),
		);
	});
});
