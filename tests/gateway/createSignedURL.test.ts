import { createSignedURL } from "../../src/core/gateway/createSignedURL";
import type {
	PinataConfig,
	SignedUrlOptions,
	OptimizeImageOptions,
} from "../../src";
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
		endpointUrl: "https://custom.api.pinata.cloud/v3",
	};

	const mockOptions: SignedUrlOptions = {
		cid: "QmTest...",
		expires: 3600,
		date: 1234567890,
	};

	const mockImageOpts: OptimizeImageOptions = {
		width: 100,
		height: 100,
		dpr: 2,
		fit: "contain",
		gravity: "auto",
		quality: 80,
		format: "webp",
		animation: true,
		sharpen: 3,
		onError: true,
		metadata: "keep",
	};

	it("should create a signed URL successfully", async () => {
		const mockSignedUrl = "https://test.mypinata.cloud/signed_url";
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ data: mockSignedUrl }),
		});

		const result = await createSignedURL(
			mockConfig,
			mockOptions,
			mockImageOpts,
		);

		expect(result).toBe(mockSignedUrl);
		expect(global.fetch).toHaveBeenCalledWith(
			"https://custom.api.pinata.cloud/v3/files/sign",
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
		await expect(
			createSignedURL(undefined, mockOptions, mockImageOpts),
		).rejects.toThrow(ValidationError);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			text: () => Promise.resolve("Unauthorized"),
		});

		await expect(
			createSignedURL(mockConfig, mockOptions, mockImageOpts),
		).rejects.toThrow(AuthenticationError);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			text: () => Promise.resolve("Server Error"),
		});

		await expect(
			createSignedURL(mockConfig, mockOptions, mockImageOpts),
		).rejects.toThrow(NetworkError);
	});

	it("should throw PinataError on unexpected errors", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValueOnce(new Error("Unexpected error"));

		await expect(
			createSignedURL(mockConfig, mockOptions, mockImageOpts),
		).rejects.toThrow(PinataError);
	});

	it("should use the correct payload in the request", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ data: "signed_url" }),
		});

		await createSignedURL(mockConfig, mockOptions, mockImageOpts);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://custom.api.pinata.cloud/v3/files/sign",
			expect.objectContaining({
				body: expect.stringContaining(
					'"url":"https://test.mypinata.cloud/files/QmTest...?img-width=100&img-height=100&img-dpr=2&img-fit=contain&img-gravity=auto&img-quality=80&img-format=webp&img-anim=true&img-sharpen=3&img-onerror=redirect&img-metadata=keep"',
				),
			}),
		);
	});

	it("should handle custom endpointUrl", async () => {
		const customConfig = {
			...mockConfig,
			endpointUrl: "https://custom.endpoint.com/v3",
		};
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ data: "signed_url" }),
		});

		await createSignedURL(customConfig, mockOptions, mockImageOpts);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://custom.endpoint.com/v3/files/sign",
			expect.any(Object),
		);
	});

	it("should use default date if not provided in options", async () => {
		const optionsWithoutDate = { ...mockOptions };
		delete optionsWithoutDate.date;
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ data: "signed_url" }),
		});

		await createSignedURL(mockConfig, optionsWithoutDate, mockImageOpts);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				body: expect.stringContaining('"date":'),
			}),
		);
	});

	it("should use custom gateway if provided in options", async () => {
		const customGatewayOptions = {
			...mockOptions,
			gateway: "https://custom.gateway.com",
		};
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ data: "signed_url" }),
		});

		await createSignedURL(mockConfig, customGatewayOptions, mockImageOpts);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				body: expect.stringContaining(
					'"url":"https://custom.gateway.com/files/QmTest...?img-width=100&img-height=100&img-dpr=2&img-fit=contain&img-gravity=auto&img-quality=80&img-format=webp&img-anim=true&img-sharpen=3&img-onerror=redirect&img-metadata=keep"',
				),
			}),
		);
	});
});
