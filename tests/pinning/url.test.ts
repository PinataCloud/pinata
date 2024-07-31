import { uploadUrl } from "../../src/core/pinning/url";
import { toPinataMetadataAPI } from "../pinata-metadata-util"; // Adjust import path as necessary
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

describe("uploadUrl function", () => {
	const mockConfig: PinataConfig = {
		pinataJwt: "test-jwt",
	};

	const mockUrl = "https://example.com/image.jpg";

	const mockResponse: PinResponse = {
		IpfsHash: "QmTest123",
		PinSize: 12345,
		Timestamp: "2023-07-26T12:00:00Z",
	};

	beforeEach(() => {
		jest.resetAllMocks();
	});

	it("should upload URL successfully", async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				arrayBuffer: jest.fn().mockResolvedValueOnce(new ArrayBuffer(8)),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce(mockResponse),
			});

		const result = await uploadUrl(mockConfig, mockUrl);

		expect(result).toEqual(mockResponse);
		expect(global.fetch).toHaveBeenCalledTimes(2);
		expect(global.fetch).toHaveBeenNthCalledWith(1, mockUrl);
		expect(global.fetch).toHaveBeenNthCalledWith(
			2,
			"https://api.pinata.cloud/pinning/pinFileToIPFS",
			expect.objectContaining({
				method: "POST",
				headers: {
					Authorization: "Bearer test-jwt",
				},
				body: expect.any(FormData),
			}),
		);
	});

	it("should handle upload options", async () => {
		const mockMetadata: PinataMetadata = {
			name: "Custom URL Name",
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

		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				arrayBuffer: jest.fn().mockResolvedValueOnce(new ArrayBuffer(8)),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce(mockResponse),
			});

		await uploadUrl(mockConfig, mockUrl, mockOptions);

		expect(global.fetch).toHaveBeenCalledTimes(2);
		const formData = (global.fetch as jest.Mock).mock.calls[1][1].body;

		expect(JSON.parse(formData.get("pinataOptions"))).toEqual({
			cidVersion: mockOptions.cidVersion,
			groupId: mockOptions.groupId,
		});
		expect(JSON.parse(formData.get("pinataMetadata"))).toEqual(
			toPinataMetadataAPI(mockMetadata),
		);
	});

	it("should use custom JWT if provided in options", async () => {
		const customJwt = "custom-jwt";
		const mockOptions: UploadOptions = {
			keys: customJwt,
		};

		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				arrayBuffer: jest.fn().mockResolvedValueOnce(new ArrayBuffer(8)),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce(mockResponse),
			});

		await uploadUrl(mockConfig, mockUrl, mockOptions);

		expect(global.fetch).toHaveBeenCalledTimes(2);
		expect(global.fetch).toHaveBeenNthCalledWith(
			2,
			"https://api.pinata.cloud/pinning/pinFileToIPFS",
			expect.objectContaining({
				headers: {
					Authorization: `Bearer ${customJwt}`,
				},
			}),
		);
	});

	it("should use default name if not provided", async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				arrayBuffer: jest.fn().mockResolvedValueOnce(new ArrayBuffer(8)),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce(mockResponse),
			});

		await uploadUrl(mockConfig, mockUrl);

		expect(global.fetch).toHaveBeenCalledTimes(2);
		const formData = (global.fetch as jest.Mock).mock.calls[1][1].body;
		expect(JSON.parse(formData.get("pinataMetadata")).name).toBe("url_upload");
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(uploadUrl(undefined, mockUrl)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw NetworkError if fetching URL fails", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 404,
			json: jest.fn().mockResolvedValueOnce({ error: "Not Found" }),
		});

		await expect(uploadUrl(mockConfig, mockUrl)).rejects.toThrow(NetworkError);
	});

	it("should throw AuthenticationError on 401 response from Pinata", async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				arrayBuffer: jest.fn().mockResolvedValueOnce(new ArrayBuffer(8)),
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 401,
				json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
			});

		await expect(uploadUrl(mockConfig, mockUrl)).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response from Pinata", async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				arrayBuffer: jest.fn().mockResolvedValueOnce(new ArrayBuffer(8)),
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
			});

		await expect(uploadUrl(mockConfig, mockUrl)).rejects.toThrow(NetworkError);
	});
});
