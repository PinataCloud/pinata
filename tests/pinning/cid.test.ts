import { uploadCid } from "../../src/core/pinning/cid";
import { toPinataMetadataAPI } from "../pinata-metadata-util"; // Adjust import path as necessary
import type {
	PinataConfig,
	UploadCIDOptions,
	PinByCIDResponse,
	PinataMetadata,
} from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("uploadCid function", () => {
	const mockConfig: PinataConfig = {
		pinataJwt: "test-jwt",
	};

	const mockCid = "QmTest123";

	const mockResponse: PinByCIDResponse = {
		id: "test-id",
		ipfsHash: mockCid,
		status: "prechecking",
		name: "Test CID",
	};

	beforeEach(() => {
		jest.resetAllMocks();
	});

	it("should upload CID successfully", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		const result = await uploadCid(mockConfig, mockCid);

		expect(result).toEqual(mockResponse);
		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/pinning/pinByHash",
			expect.objectContaining({
				method: "POST",
				headers: {
					Source: "sdk/cid",
					"Content-Type": "application/json",
					Authorization: "Bearer test-jwt",
				},
				body: expect.any(String),
			}),
		);
	});

	it("should handle upload options", async () => {
		const mockMetadata: PinataMetadata = {
			name: "Test CID",
			keyValues: {
				key1: "value1",
				key2: "value2",
			},
		};
		const mockOptions: UploadCIDOptions = {
			metadata: mockMetadata,
			peerAddresses: ["peer1", "peer2"],
			groupId: "test-group",
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce(mockResponse),
		});

		await uploadCid(mockConfig, mockCid, mockOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/pinning/pinByHash",
			expect.objectContaining({
				method: "POST",
				headers: {
					Source: "sdk/cid",
					"Content-Type": "application/json",
					Authorization: "Bearer test-jwt",
				},
				body: expect.any(String),
			}),
		);

		const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
		const requestBody = JSON.parse(fetchCall[1].body);

		expect(requestBody).toEqual({
			hashToPin: mockCid,
			pinataMetadata: toPinataMetadataAPI(mockMetadata),
			pinataOptions: {
				hostNodes: mockOptions.peerAddresses,
				groupId: mockOptions.groupId,
			},
		});
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(uploadCid(undefined, mockCid)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
		});

		await expect(uploadCid(mockConfig, mockCid)).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: jest.fn().mockResolvedValueOnce({ error: "Server Error" }),
		});

		await expect(uploadCid(mockConfig, mockCid)).rejects.toThrow(NetworkError);
	});

	it("should throw PinataError on fetch failure", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValueOnce(new Error("Network failure"));

		await expect(uploadCid(mockConfig, mockCid)).rejects.toThrow(PinataError);
	});
});
