import { updateMetadata } from "../../src/core/data/updateMetadata";
import type { PinataConfig, PinataMetadataUpdate } from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("updateMetadata function", () => {
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

	const mockOptions: PinataMetadataUpdate = {
		cid: "QmTest...",
		name: "Updated File Name",
		keyValues: {
			key1: "value1",
			key2: 2,
		},
	};

	it("should update metadata successfully", async () => {
		const mockResponse = "Metadata updated successfully";

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			text: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		const result = await updateMetadata(mockConfig, mockOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/pinning/hashMetadata",
			{
				method: "PUT",
				headers: {
					Source: "sdk/updateMetadata",
					"Content-Type": "application/json",
					Authorization: `Bearer ${mockConfig.pinataJwt}`,
				},
				body: JSON.stringify({
					ipfsPinHash: mockOptions.cid,
					name: mockOptions.name,
					keyvalues: mockOptions.keyValues,
				}),
			},
		);
		expect(result).toEqual(mockResponse);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(updateMetadata(undefined, mockOptions)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
		});

		await expect(updateMetadata(mockConfig, mockOptions)).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
		});

		await expect(updateMetadata(mockConfig, mockOptions)).rejects.toThrow(
			NetworkError,
		);
	});

	it("should throw PinataError on unexpected errors", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValueOnce(new Error("Unexpected error"));

		await expect(updateMetadata(mockConfig, mockOptions)).rejects.toThrow(
			PinataError,
		);
	});

	it("should handle updating only name", async () => {
		const nameOnlyOptions: PinataMetadataUpdate = {
			cid: "QmTest...",
			name: "New Name Only",
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			text: jest.fn().mockResolvedValueOnce("Metadata updated successfully"),
		});

		await updateMetadata(mockConfig, nameOnlyOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				body: JSON.stringify({
					ipfsPinHash: nameOnlyOptions.cid,
					name: nameOnlyOptions.name,
					keyvalues: undefined,
				}),
			}),
		);
	});

	it("should handle updating only keyValues", async () => {
		const keyValuesOnlyOptions: PinataMetadataUpdate = {
			cid: "QmTest...",
			keyValues: {
				newKey: "newValue",
			},
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			text: jest.fn().mockResolvedValueOnce("Metadata updated successfully"),
		});

		await updateMetadata(mockConfig, keyValuesOnlyOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				body: JSON.stringify({
					ipfsPinHash: keyValuesOnlyOptions.cid,
					name: undefined,
					keyvalues: keyValuesOnlyOptions.keyValues,
				}),
			}),
		);
	});

	it("should handle empty keyValues object", async () => {
		const emptyKeyValuesOptions: PinataMetadataUpdate = {
			cid: "QmTest...",
			name: "Test Name",
			keyValues: {},
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			text: jest.fn().mockResolvedValueOnce("Metadata updated successfully"),
		});

		await updateMetadata(mockConfig, emptyKeyValuesOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				body: JSON.stringify({
					ipfsPinHash: emptyKeyValuesOptions.cid,
					name: emptyKeyValuesOptions.name,
					keyvalues: {},
				}),
			}),
		);
	});
});
