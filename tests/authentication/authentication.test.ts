import { testAuthentication } from "../../src/core/authentication/testAuthentication";
import type { PinataConfig } from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("testAuthentication function", () => {
	let originalFetch: typeof fetch;

	beforeEach(() => {
		originalFetch = global.fetch;
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it("should test authentication successfully", async () => {
		const mockConfig: PinataConfig = {
			pinataJwt: "test_jwt",
			pinataGateway: "test.cloud",
		};
		const mockResponse = {
			message: "Congratulations! You are communicating with the Pinata API!",
		};
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		const result = await testAuthentication(mockConfig);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/data/testAuthentication",
			{
				method: "GET",
				headers: {
					Source: "sdk/testAuthentication",
					Authorization: `Bearer ${mockConfig.pinataJwt}`,
				},
			},
		);
		expect(result).toEqual(mockResponse);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(testAuthentication(undefined)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		const mockConfig: PinataConfig = {
			pinataJwt: "invalid_jwt",
			pinataGateway: "test.cloud",
		};
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			text: jest.fn().mockResolvedValueOnce("Unauthorized"),
		});

		await expect(testAuthentication(mockConfig)).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		const mockConfig: PinataConfig = {
			pinataJwt: "test_jwt",
			pinataGateway: "test.cloud",
		};
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			text: jest.fn().mockResolvedValueOnce("server error"),
		});

		await expect(testAuthentication(mockConfig)).rejects.toThrow(NetworkError);
	});

	it("should throw PinataError on unexpected errors", async () => {
		const mockConfig: PinataConfig = {
			pinataJwt: "test_jwt",
			pinataGateway: "test.cloud",
		};
		global.fetch = jest
			.fn()
			.mockRejectedValueOnce(new Error("Unexpected error"));

		await expect(testAuthentication(mockConfig)).rejects.toThrow(PinataError);
	});
});
