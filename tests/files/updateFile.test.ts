import { updateFile } from "../../src/core/functions/files/updateFile";
import type { PinataConfig, UpdateFileOptions, FileListItem } from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("updateFile function", () => {
	let originalFetch: typeof fetch;

	beforeEach(() => {
		originalFetch = global.fetch;
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	const mockConfig: PinataConfig = {
		pinataJwt: "test_jwt",
		pinataGateway: "test.cloud",
	};

	const mockOptions: UpdateFileOptions = {
		id: "testId",
		name: "Updated File Name",
	};

	describe("public network", () => {
		it("should update file successfully", async () => {
			const mockResponse: FileListItem = {
				id: "testId",
				name: "Updated File Name",
				cid: "QmTest...",
				size: 1000,
				number_of_files: 1,
				mime_type: "text/plain",
				group_id: "groupId",
				created_at: "2023-01-01T00:00:00Z",
				keyvalues: {},
			};

			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
			});

			const result = await updateFile(mockConfig, mockOptions, "public");

			expect(global.fetch).toHaveBeenCalledWith(
				"https://api.pinata.cloud/v3/files/public/testId",
				expect.objectContaining({
					method: "PUT",
					headers: expect.objectContaining({
						Authorization: `Bearer ${mockConfig.pinataJwt}`,
					}),
					body: JSON.stringify({
						name: mockOptions.name,
					}),
				}),
			);
			expect(result).toEqual(mockResponse);
		});

		it("should throw ValidationError if config is missing", async () => {
			await expect(
				updateFile(undefined, mockOptions, "public"),
			).rejects.toThrow(ValidationError);
		});

		it("should throw AuthenticationError on 401 response", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: jest.fn().mockResolvedValueOnce("Unauthorized"),
			});

			await expect(
				updateFile(mockConfig, mockOptions, "public"),
			).rejects.toThrow(AuthenticationError);
		});

		it("should throw NetworkError on non-401 error response", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: jest.fn().mockResolvedValueOnce("Server Error"),
			});

			await expect(
				updateFile(mockConfig, mockOptions, "public"),
			).rejects.toThrow(NetworkError);
		});

		it("should throw PinataError on unexpected errors", async () => {
			global.fetch = jest
				.fn()
				.mockRejectedValueOnce(new Error("Unexpected error"));

			await expect(
				updateFile(mockConfig, mockOptions, "public"),
			).rejects.toThrow(PinataError);
		});
	});

	describe("private network", () => {
		it("should update file successfully", async () => {
			const mockResponse: FileListItem = {
				id: "testId",
				name: "Updated File Name",
				cid: "QmTest...",
				size: 1000,
				number_of_files: 1,
				mime_type: "text/plain",
				group_id: "groupId",
				created_at: "2023-01-01T00:00:00Z",
				keyvalues: {},
			};

			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
			});

			const result = await updateFile(mockConfig, mockOptions, "private");

			expect(global.fetch).toHaveBeenCalledWith(
				"https://api.pinata.cloud/v3/files/private/testId",
				expect.objectContaining({
					method: "PUT",
					headers: expect.objectContaining({
						Authorization: `Bearer ${mockConfig.pinataJwt}`,
					}),
					body: JSON.stringify({
						name: mockOptions.name,
					}),
				}),
			);
			expect(result).toEqual(mockResponse);
		});

		it("should throw ValidationError if config is missing", async () => {
			await expect(
				updateFile(undefined, mockOptions, "private"),
			).rejects.toThrow(ValidationError);
		});

		it("should throw AuthenticationError on 401 response", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: jest.fn().mockResolvedValueOnce("Unauthorized"),
			});

			await expect(
				updateFile(mockConfig, mockOptions, "private"),
			).rejects.toThrow(AuthenticationError);
		});

		it("should throw NetworkError on non-401 error response", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: jest.fn().mockResolvedValueOnce("Server Error"),
			});

			await expect(
				updateFile(mockConfig, mockOptions, "private"),
			).rejects.toThrow(NetworkError);
		});

		it("should throw PinataError on unexpected errors", async () => {
			global.fetch = jest
				.fn()
				.mockRejectedValueOnce(new Error("Unexpected error"));

			await expect(
				updateFile(mockConfig, mockOptions, "private"),
			).rejects.toThrow(PinataError);
		});
	});

	it("should use custom headers if provided", async () => {
		const customConfig: PinataConfig = {
			...mockConfig,
			customHeaders: {
				"Custom-Header": "Custom-Value",
			},
		};

		const mockResponse: FileListItem = {
			id: "testId",
			name: "Updated File Name",
			cid: "QmTest...",
			size: 1000,
			number_of_files: 1,
			mime_type: "text/plain",
			group_id: "groupId",
			created_at: "2023-01-01T00:00:00Z",
			keyvalues: {},
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		await updateFile(customConfig, mockOptions, "private");

		expect(global.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				headers: expect.objectContaining({
					"Custom-Header": "Custom-Value",
				}),
			}),
		);
	});

	it("should use custom endpoint if provided", async () => {
		const customConfig: PinataConfig = {
			...mockConfig,
			endpointUrl: "https://custom.api.pinata.cloud",
		};

		const mockResponse: FileListItem = {
			id: "testId",
			name: "Updated File Name",
			cid: "QmTest...",
			size: 1000,
			number_of_files: 1,
			mime_type: "text/plain",
			group_id: "groupId",
			created_at: "2023-01-01T00:00:00Z",
			keyvalues: {},
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
		});

		await updateFile(customConfig, mockOptions, "private");

		expect(global.fetch).toHaveBeenCalledWith(
			"https://custom.api.pinata.cloud/files/private/testId",
			expect.any(Object),
		);
	});
});
