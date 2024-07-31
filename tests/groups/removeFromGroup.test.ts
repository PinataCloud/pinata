import { removeFromGroup } from "../../src/core/groups/removeFromGroup";
import type { PinataConfig, GroupCIDOptions } from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("removeFromGroup function", () => {
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

	const mockOptions: GroupCIDOptions = {
		groupId: "test-group-id",
		cids: ["Qm123...", "Qm456..."],
	};

	it("should remove CIDs from group successfully", async () => {
		const mockResponse = "CIDs removed from group successfully";
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			text: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		const result = await removeFromGroup(mockConfig, mockOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/groups/test-group-id/cids",
			{
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${mockConfig.pinataJwt}`,
				},
				body: JSON.stringify({ cids: mockOptions.cids }),
			},
		);
		expect(result).toEqual(mockResponse);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(removeFromGroup(undefined, mockOptions)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
		});

		await expect(removeFromGroup(mockConfig, mockOptions)).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
		});

		await expect(removeFromGroup(mockConfig, mockOptions)).rejects.toThrow(
			NetworkError,
		);
	});

	it("should throw PinataError on unexpected errors", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValueOnce(new Error("Unexpected error"));

		await expect(removeFromGroup(mockConfig, mockOptions)).rejects.toThrow(
			PinataError,
		);
	});

	it("should handle empty CIDs array", async () => {
		const emptyOptions: GroupCIDOptions = {
			groupId: "test-group-id",
			cids: [],
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			text: jest.fn().mockResolvedValueOnce("No CIDs removed"),
		});

		await removeFromGroup(mockConfig, emptyOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				body: JSON.stringify({ cids: [] }),
			}),
		);
	});

	it("should handle large number of CIDs", async () => {
		const largeCIDsOptions: GroupCIDOptions = {
			groupId: "test-group-id",
			cids: Array(1000).fill("Qm..."),
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			text: jest.fn().mockResolvedValueOnce("CIDs removed successfully"),
		});

		await removeFromGroup(mockConfig, largeCIDsOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				body: expect.stringContaining(
					'"cids":' + JSON.stringify(largeCIDsOptions.cids),
				),
			}),
		);
	});

	it("should use correct groupId in URL", async () => {
		const customGroupIdOptions: GroupCIDOptions = {
			groupId: "custom-group-123",
			cids: ["Qm789..."],
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			text: jest.fn().mockResolvedValueOnce("CID removed successfully"),
		});

		await removeFromGroup(mockConfig, customGroupIdOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/groups/custom-group-123/cids",
			expect.any(Object),
		);
	});

	it("should handle non-existent CIDs gracefully", async () => {
		const nonExistentCIDOptions: GroupCIDOptions = {
			groupId: "test-group-id",
			cids: ["NonExistentCID1", "NonExistentCID2"],
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			text: jest.fn().mockResolvedValueOnce("No CIDs removed"),
		});

		const result = await removeFromGroup(mockConfig, nonExistentCIDOptions);

		expect(result).toEqual("No CIDs removed");
	});
});
