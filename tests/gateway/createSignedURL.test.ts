import { createSignedURL } from "../../src/core/gateway/createSignedURL";
import type { PinataConfig, SignedUrlOptions } from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("createSignedURL function", () => {
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

	const mockOptions: SignedUrlOptions = {
		cid: "QmTest...",
		expires: 3600,
	};

	it("should create a signed URL successfully", async () => {
		const mockSignedUrl = "https://test.mypinata.cloud/signed_url";
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ data: mockSignedUrl }),
		});

		const result = await createSignedURL(mockConfig, mockOptions);

		expect(result).toBe(mockSignedUrl);
		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/v3/files/sign",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					"Content-Type": "application/json",
					Authorization: "Bearer test_jwt",
				}),
				body: expect.any(String),
			}),
		);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(createSignedURL(undefined, mockOptions)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: () => Promise.resolve({ error: "Server Error" }),
		});

		await expect(createSignedURL(mockConfig, mockOptions)).rejects.toThrow(
			PinataError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			text: () => Promise.resolve("Server Error"),
		});

		await expect(createSignedURL(mockConfig, mockOptions)).rejects.toThrow(
			NetworkError,
		);
	});

	it("should throw PinataError on unexpected errors", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValueOnce(new Error("Unexpected error"));

		await expect(createSignedURL(mockConfig, mockOptions)).rejects.toThrow(
			PinataError,
		);
	});

	it("should use the correct payload in the request", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ data: "signed_url" }),
		});

		await createSignedURL(mockConfig, mockOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/v3/files/sign",
			expect.objectContaining({
				body: expect.stringContaining(
					'"url":"https://test.mypinata.cloud/files/QmTest..."',
				),
			}),
		);
	});
});
