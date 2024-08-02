import { createKey } from "../../src/core/keys/createKey";
import type { PinataConfig, KeyOptions, KeyResponse } from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("createKey function", () => {
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

	const mockOptions: KeyOptions = {
		keyName: "Test Key",
		permissions: {
			admin: false,
			endpoints: {
				data: {
					pinList: true,
					userPinnedDataTotal: true,
				},
				pinning: {
					pinFileToIPFS: true,
					pinJSONToIPFS: true,
				},
			},
		},
		maxUses: 100,
	};

	const mockResponse: KeyResponse = {
		JWT: "new_jwt_token",
		pinata_api_key: "new_api_key",
		pinata_api_secret: "new_api_secret",
	};

	it("should create a key successfully", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		const result = await createKey(mockConfig, mockOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/v3/pinata/keys",
			{
				method: "POST",
				headers: {
					Source: "sdk/createKey",
					"Content-Type": "application/json",
					Authorization: `Bearer ${mockConfig.pinataJwt}`,
				},
				body: JSON.stringify(mockOptions),
			},
		);
		expect(result).toEqual(mockResponse);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(createKey(undefined, mockOptions)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
		});

		await expect(createKey(mockConfig, mockOptions)).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
		});

		await expect(createKey(mockConfig, mockOptions)).rejects.toThrow(
			NetworkError,
		);
	});

	it("should throw PinataError on unexpected errors", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValueOnce(new Error("Unexpected error"));

		await expect(createKey(mockConfig, mockOptions)).rejects.toThrow(
			PinataError,
		);
	});

	it("should handle creating an admin key", async () => {
		const adminKeyOptions: KeyOptions = {
			...mockOptions,
			permissions: {
				admin: true,
			},
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		await createKey(mockConfig, adminKeyOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				body: JSON.stringify(adminKeyOptions),
			}),
		);
	});

	it("should handle creating a key with no max uses", async () => {
		const noMaxUsesOptions: KeyOptions = {
			...mockOptions,
			maxUses: undefined,
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		await createKey(mockConfig, noMaxUsesOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				body: JSON.stringify(noMaxUsesOptions),
			}),
		);
	});

	it("should handle creating a key with a very long name", async () => {
		const longNameOptions: KeyOptions = {
			...mockOptions,
			keyName: "A".repeat(1000),
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		await createKey(mockConfig, longNameOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				body: JSON.stringify(longNameOptions),
			}),
		);
	});

	it("should handle creating a key with all permissions", async () => {
		const allPermissionsOptions: KeyOptions = {
			keyName: "All Permissions Key",
			permissions: {
				admin: false,
				endpoints: {
					data: {
						pinList: true,
						userPinnedDataTotal: true,
					},
					pinning: {
						pinFileToIPFS: true,
						pinJSONToIPFS: true,
						pinByHash: true,
						pinJobs: true,
						unpin: true,
						hashMetadata: true,
						hashPinPolicy: true,
						userPinPolicy: true,
					},
				},
			},
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		await createKey(mockConfig, allPermissionsOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				body: JSON.stringify(allPermissionsOptions),
			}),
		);
	});
});
