import { deleteFile } from "../../src/core/files/delete";
import type { PinataConfig, DeleteResponse } from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("deleteFile function", () => {
	const mockConfig: PinataConfig = {
		pinataJwt: "test-jwt",
	};

	const mockFiles = ["QmTest123", "QmTest456"];

	beforeEach(() => {
		jest.resetAllMocks();
	});

	it("should delete files successfully", async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				statusText: "OK",
			})
			.mockResolvedValueOnce({
				ok: true,
				statusText: "OK",
			});

		const result = await deleteFile(mockConfig, mockFiles);

		expect(result).toEqual([
			{ id: "QmTest123", status: "OK" },
			{ id: "QmTest456", status: "OK" },
		]);

		expect(global.fetch).toHaveBeenCalledTimes(2);
	});

	it("should handle mixed success and failure", async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				statusText: "OK",
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 404,
				text: jest.fn().mockResolvedValueOnce("Not Found"),
			});

		const result = await deleteFile(mockConfig, mockFiles);

		expect(result).toEqual([
			{ id: "QmTest123", status: "OK" },
			{
				id: "QmTest456",
				status: "HTTP error: Not Found",
			},
		]);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(deleteFile(undefined, mockFiles)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should handle AuthenticationError", async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: false,
			status: 401,
			text: jest.fn().mockResolvedValue("Unauthorized"),
		});

		const result = await deleteFile(mockConfig, mockFiles);

		expect(result).toEqual([
			{ id: "QmTest123", status: "Authentication failed: Unauthorized" },
			{ id: "QmTest456", status: "Authentication failed: Unauthorized" },
		]);
	});

	it("should handle NetworkError", async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: false,
			status: 500,
			text: jest.fn().mockResolvedValue("Server Error"),
		});

		const result = await deleteFile(mockConfig, mockFiles);

		expect(result).toEqual([
			{ id: "QmTest123", status: "HTTP error: Server Error" },
			{ id: "QmTest456", status: "HTTP error: Server Error" },
		]);
	});

	it("should handle fetch failure", async () => {
		global.fetch = jest.fn().mockRejectedValue(new Error("Network failure"));

		const result = await deleteFile(mockConfig, mockFiles);

		expect(result).toEqual([
			{
				id: "QmTest123",
				status: "Error deleting file QmTest123: Network failure",
			},
			{
				id: "QmTest456",
				status: "Error deleting file QmTest456: Network failure",
			},
		]);
	});

	it("should handle unknown errors", async () => {
		global.fetch = jest.fn().mockRejectedValue("Unknown error");

		const result = await deleteFile(mockConfig, mockFiles);

		expect(result).toEqual([
			{
				id: "QmTest123",
				status: "An unknown error occurred while deleting file QmTest123",
			},
			{
				id: "QmTest456",
				status: "An unknown error occurred while deleting file QmTest456",
			},
		]);
	});
});