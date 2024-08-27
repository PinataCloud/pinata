import { unpinFile } from "../../src/core/pinning/unpin";
import type { PinataConfig, DeleteResponse } from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("unpinFile function", () => {
	const mockConfig: PinataConfig = {
		pinataJwt: "test-jwt",
	};

	const mockHashes = ["QmTest123", "QmTest456"];

	beforeEach(() => {
		jest.resetAllMocks();
	});

	it("should unpin files successfully", async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				text: jest.fn().mockResolvedValueOnce("Unpin successful"),
			})
			.mockResolvedValueOnce({
				ok: true,
				text: jest.fn().mockResolvedValueOnce("Unpin successful"),
			});

		const result = await unpinFile(mockConfig, mockHashes);

		expect(result).toEqual([
			{ hash: "QmTest123", status: "Unpin successful" },
			{ hash: "QmTest456", status: "Unpin successful" },
		]);

		expect(global.fetch).toHaveBeenCalledTimes(2);
	});

	it("should handle mixed success and failure", async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				text: jest.fn().mockResolvedValueOnce("Unpin successful"),
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 404,
				text: jest.fn().mockResolvedValueOnce("Not Found"),
			});

		const result = await unpinFile(mockConfig, mockHashes);

		expect(result).toEqual([
			{ hash: "QmTest123", status: "Unpin successful" },
			{
				hash: "QmTest456",
				status: "HTTP error: Not Found",
			},
		]);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(unpinFile(undefined, mockHashes)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should handle AuthenticationError", async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: false,
			status: 401,
			text: jest.fn().mockResolvedValue("Unauthorized"),
		});

		const result = await unpinFile(mockConfig, mockHashes);

		expect(result).toEqual([
			{ hash: "QmTest123", status: "Authentication failed: Unauthorized" },
			{ hash: "QmTest456", status: "Authentication failed: Unauthorized" },
		]);
	});

	it("should handle NetworkError", async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: false,
			status: 500,
			text: jest.fn().mockResolvedValue("Server Error"),
		});

		const result = await unpinFile(mockConfig, mockHashes);

		expect(result).toEqual([
			{ hash: "QmTest123", status: "HTTP error: Server Error" },
			{ hash: "QmTest456", status: "HTTP error: Server Error" },
		]);
	});

	it("should handle fetch failure", async () => {
		global.fetch = jest.fn().mockRejectedValue(new Error("Network failure"));

		const result = await unpinFile(mockConfig, mockHashes);

		expect(result).toEqual([
			{
				hash: "QmTest123",
				status: "Error unpinning file QmTest123: Network failure",
			},
			{
				hash: "QmTest456",
				status: "Error unpinning file QmTest456: Network failure",
			},
		]);
	});

	it("should handle unknown errors", async () => {
		global.fetch = jest.fn().mockRejectedValue("Unknown error");

		const result = await unpinFile(mockConfig, mockHashes);

		expect(result).toEqual([
			{
				hash: "QmTest123",
				status: "An unknown error occurred while unpinning file QmTest123",
			},
			{
				hash: "QmTest456",
				status: "An unknown error occurred while unpinning file QmTest456",
			},
		]);
	});
});
