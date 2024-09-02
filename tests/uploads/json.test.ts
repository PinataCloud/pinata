import { uploadJson } from "../../src/core/uploads/json";
import type {
	PinataConfig,
	UploadOptions,
	UploadResponse,
	PinataMetadata,
	JsonBody,
} from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("uploadJson function", () => {
	const mockConfig: PinataConfig = {
		pinataJwt: "test-jwt",
	};

	const mockJsonData: JsonBody = {
		key1: "value1",
		key2: 2,
		key3: {
			nestedKey: "nestedValue",
		},
	};

	const mockResponse: UploadResponse = {
		id: "testId",
		name: "testName",
		cid: "QmTest123",
		size: 123,
		number_of_files: 1,
		mime_type: "application/json",
		user_id: "testUserId",
	};

	beforeEach(() => {
		jest.resetAllMocks();
	});

	it("should upload JSON successfully", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		const result = await uploadJson(mockConfig, mockJsonData);

		expect(result).toEqual(mockResponse);
		expect(global.fetch).toHaveBeenCalledWith(
			"https://uploads.pinata.cloud/v3/files",
			expect.objectContaining({
				method: "POST",
				headers: {
					Source: "sdk/json",
					Authorization: "Bearer test-jwt",
				},
				body: expect.any(FormData),
			}),
		);
	});

	it("should handle upload options", async () => {
		const mockMetadata: PinataMetadata = {
			name: "Custom JSON Name",
		};
		const mockOptions: UploadOptions = {
			metadata: mockMetadata,
			groupId: "test-group",
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		await uploadJson(mockConfig, mockJsonData, mockOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://uploads.pinata.cloud/v3/files",
			expect.objectContaining({
				method: "POST",
				headers: {
					Source: "sdk/json",
					Authorization: "Bearer test-jwt",
				},
				body: expect.any(FormData),
			}),
		);

		const formData = (global.fetch as jest.Mock).mock.calls[0][1].body;
		expect(formData.get("name")).toBe("Custom JSON Name");
		expect(formData.get("group_id")).toBe("test-group");
	});

	it("should use custom JWT if provided in options", async () => {
		const customJwt = "custom-jwt";
		const mockOptions: UploadOptions = {
			keys: customJwt,
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		await uploadJson(mockConfig, mockJsonData, mockOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://uploads.pinata.cloud/v3/files",
			expect.objectContaining({
				headers: {
					Source: "sdk/json",
					Authorization: `Bearer ${customJwt}`,
				},
			}),
		);
	});

	it("should use default name if not provided", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		await uploadJson(mockConfig, mockJsonData);

		const formData = (global.fetch as jest.Mock).mock.calls[0][1].body;
		expect(formData.get("name")).toBe("data.json");
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(uploadJson(undefined, mockJsonData)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			text: jest.fn().mockResolvedValueOnce("Unauthorized"),
		});

		await expect(uploadJson(mockConfig, mockJsonData)).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			text: jest.fn().mockResolvedValueOnce("Server Error"),
		});

		await expect(uploadJson(mockConfig, mockJsonData)).rejects.toThrow(
			NetworkError,
		);
	});

	it("should throw PinataError on fetch failure", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValueOnce(new Error("Network failure"));

		await expect(uploadJson(mockConfig, mockJsonData)).rejects.toThrow(
			PinataError,
		);
	});
});
