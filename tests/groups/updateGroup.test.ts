import { updateGroup } from "../../src/core/groups/updateGroup";
import type {
	PinataConfig,
	UpdateGroupOptions,
	GroupResponseItem,
} from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("updateGroup function", () => {
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

	const mockOptions: UpdateGroupOptions = {
		groupId: "test-group-id",
		name: "Updated Group Name",
	};

	const mockResponse: GroupResponseItem = {
		id: "test-group-id",
		name: "Updated Group Name",
		user_id: "test-user-id",
		createdAt: "2023-07-26T12:00:00Z",
		updatedAt: "2023-07-26T13:00:00Z",
	};

	it("should update group successfully", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		const result = await updateGroup(mockConfig, mockOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/groups/test-group-id",
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${mockConfig.pinataJwt}`,
				},
				body: JSON.stringify({ name: mockOptions.name }),
			},
		);
		expect(result).toEqual(mockResponse);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(updateGroup(undefined, mockOptions)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
		});

		await expect(updateGroup(mockConfig, mockOptions)).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
		});

		await expect(updateGroup(mockConfig, mockOptions)).rejects.toThrow(
			NetworkError,
		);
	});

	it("should throw PinataError on unexpected errors", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValueOnce(new Error("Unexpected error"));

		await expect(updateGroup(mockConfig, mockOptions)).rejects.toThrow(
			PinataError,
		);
	});

	it("should handle updating to an empty name", async () => {
		const emptyNameOptions: UpdateGroupOptions = {
			groupId: "test-group-id",
			name: "",
		};

		const emptyNameResponse: GroupResponseItem = {
			...mockResponse,
			name: "",
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(emptyNameResponse),
		});

		const result = await updateGroup(mockConfig, emptyNameOptions);

		expect(result.name).toBe("");
	});

	it("should handle updating with a very long name", async () => {
		const longName = "A".repeat(1000);
		const longNameOptions: UpdateGroupOptions = {
			groupId: "test-group-id",
			name: longName,
		};

		const longNameResponse: GroupResponseItem = {
			...mockResponse,
			name: longName,
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(longNameResponse),
		});

		const result = await updateGroup(mockConfig, longNameOptions);

		expect(result.name).toBe(longName);
	});

	it("should handle updating a non-existent group", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 404,
			json: jest.fn().mockResolvedValueOnce({ error: "Group not found" }),
		});

		await expect(
			updateGroup(mockConfig, { ...mockOptions, groupId: "non-existent-id" }),
		).rejects.toThrow(NetworkError);
	});

	it("should use correct groupId in URL", async () => {
		const customGroupIdOptions: UpdateGroupOptions = {
			groupId: "custom-group-123",
			name: "Custom Group Name",
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({
				...mockResponse,
				id: customGroupIdOptions.groupId,
			}),
		});

		await updateGroup(mockConfig, customGroupIdOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/groups/custom-group-123",
			expect.any(Object),
		);
	});

	it("should handle updating with special characters in name", async () => {
		const specialNameOptions: UpdateGroupOptions = {
			groupId: "test-group-id",
			name: "Special @#$%^&*() Group",
		};

		const specialNameResponse: GroupResponseItem = {
			...mockResponse,
			name: specialNameOptions.name,
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(specialNameResponse),
		});

		const result = await updateGroup(mockConfig, specialNameOptions);

		expect(result.name).toBe(specialNameOptions.name);
	});
});
