import { uploadBase64 } from "../../src/core/pinning/base64";
import type {
	PinataConfig,
	UploadOptions,
	PinResponse,
	PinataMetadata,
} from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";
import { toPinataMetadataAPI } from "../pinata-metadata-util";

describe("uploadBase64 function", () => {
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

	const mockBase64String =
		"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==";

	const mockResponse: PinResponse = {
		IpfsHash: "QmTest123",
		PinSize: 1234,
		Timestamp: "2023-07-26T12:00:00Z",
	};

	it("should upload base64 successfully", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		const result = await uploadBase64(mockConfig, mockBase64String);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/pinning/pinFileToIPFS",
			expect.objectContaining({
				method: "POST",
				headers: {
					Source: "sdk/base64",
					Authorization: `Bearer ${mockConfig.pinataJwt}`,
				},
				body: expect.any(FormData),
			}),
		);
		expect(result).toEqual(mockResponse);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(uploadBase64(undefined, mockBase64String)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
		});

		await expect(uploadBase64(mockConfig, mockBase64String)).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
		});

		await expect(uploadBase64(mockConfig, mockBase64String)).rejects.toThrow(
			NetworkError,
		);
	});

	it("should handle upload options", async () => {
		const mockMetadata: PinataMetadata = {
			name: "Test File",
			keyValues: {
				key1: "value1",
				key2: "value2",
			},
		};

		const mockOptions: UploadOptions = {
			metadata: mockMetadata,
			cidVersion: 1,
			groupId: "test-group",
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		await uploadBase64(mockConfig, mockBase64String, mockOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/pinning/pinFileToIPFS",
			expect.objectContaining({
				body: expect.any(FormData),
			}),
		);

		const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
		const formData = fetchCall[1].body as FormData;

		expect(JSON.parse(formData.get("pinataOptions") as string)).toEqual({
			cidVersion: mockOptions.cidVersion,
			groupId: mockOptions.groupId,
		});
		expect(JSON.parse(formData.get("pinataMetadata") as string)).toEqual(
			toPinataMetadataAPI(mockMetadata),
		);
	});

	it("should use custom JWT if provided in options", async () => {
		const customJwt = "custom_jwt_token";
		const mockOptions: UploadOptions = {
			keys: customJwt,
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		await uploadBase64(mockConfig, mockBase64String, mockOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/pinning/pinFileToIPFS",
			expect.objectContaining({
				headers: {
					Source: "sdk/base64",
					Authorization: `Bearer ${customJwt}`,
				},
			}),
		);
	});
});
