import { uploadUrl } from "../../src/core/uploads/url";
import type {
	PinataConfig,
	UploadOptions,
	UploadResponse,
	PinataMetadata,
} from "../../src/core/types";
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

	const mockResponse: UploadResponse = {
		id: "test-id",
		name: "test-name",
		cid: "QmTest123",
		size: 12345,
		number_of_files: 1,
		mime_type: "image/jpeg",
		user_id: "test-user-id",
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
			"https://uploads.pinata.cloud/v3/files",
			expect.objectContaining({
				method: "POST",
				headers: {
					Source: "sdk/url",
					Authorization: "Bearer test-jwt",
				},
				body: expect.any(FormData),
			}),
		);
	});

	it("should handle upload options", async () => {
		const mockMetadata: PinataMetadata = {
			name: "Custom URL Name",
		};
		const mockOptions: UploadOptions = {
			metadata: mockMetadata,
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

		expect(formData.get("name")).toBe("Custom URL Name");
		expect(formData.get("group_id")).toBe("test-group");
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
			"https://uploads.pinata.cloud/v3/files",
			expect.objectContaining({
				headers: {
					Source: "sdk/url",
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
		expect(formData.get("name")).toBe("url_upload");
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
			text: jest.fn().mockResolvedValueOnce("Not Found"),
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
				text: jest.fn().mockResolvedValueOnce("Unauthorized"),
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
				text: jest.fn().mockResolvedValueOnce("Server Error"),
			});

		await expect(uploadUrl(mockConfig, mockUrl)).rejects.toThrow(NetworkError);
	});
});
