import { uploadCid } from "../../src/core/functions";
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
	let originalFetch: typeof fetch;

	beforeEach(() => {
		originalFetch = global.fetch;
	});

	afterEach(() => {
		global.fetch = originalFetch;
		jest.clearAllMocks();
	});

	const mockConfig: PinataConfig = {
		pinataJwt: "test-jwt",
		pinataGateway: "https://test.mypinata.cloud",
	};

	const mockCid = "QmTest123";

	const mockResponse: PinByCIDResponse = {
		id: "testId",
		cid: "QmTest123",
		name: "test.txt",
		status: "prechecking",
	};

	it("should pin CID successfully", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({
				id: "testId",
				ipfsHash: "QmTest123",
				name: "test.txt",
				status: "prechecking",
			}),
		});

		const result = await uploadCid(mockConfig, mockCid);

		expect(result).toEqual(mockResponse);
		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/pinning/pinByHash",
			expect.objectContaining({
				method: "POST",
				headers: {
					Source: "sdk/cid",
					Authorization: "Bearer test-jwt",
					"Content-Type": "application/json",
				},
			}),
		);
	});

	it("should handle upload options with metadata", async () => {
		const mockMetadata: PinataMetadata = {
			name: "Custom File Name",
			keyvalues: {
				key1: "value1",
			},
		};
		const mockOptions: UploadCIDOptions = {
			metadata: mockMetadata,
			peerAddresses: ["peer1", "peer2"],
			groupId: "test-group",
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({
				id: "testId",
				ipfsHash: "QmTest123",
				name: "Custom File Name",
				status: "prechecking",
			}),
		});

		await uploadCid(mockConfig, mockCid, mockOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/pinning/pinByHash",
			expect.objectContaining({
				method: "POST",
				headers: {
					Source: "sdk/cid",
					Authorization: "Bearer test-jwt",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					hashToPin: mockCid,
					pinataMetadata: mockMetadata,
					pinataOptions: {
						hostNodes: mockOptions.peerAddresses,
						groupId: mockOptions.groupId,
					},
				}),
			}),
		);
	});

	it("should use custom JWT if provided in options", async () => {
		const customJwt = "custom-jwt";
		const mockOptions: UploadCIDOptions = {
			keys: customJwt,
		};

		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({
				id: "testId",
				ipfsHash: "QmTest123",
				name: mockCid,
				status: "prechecking",
			}),
		});

		await uploadCid(mockConfig, mockCid, mockOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/pinning/pinByHash",
			expect.objectContaining({
				headers: {
					Source: "sdk/cid",
					Authorization: `Bearer ${customJwt}`,
					"Content-Type": "application/json",
				},
			}),
		);
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
			text: jest.fn().mockResolvedValueOnce("Unauthorized"),
		});

		await expect(uploadCid(mockConfig, mockCid)).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			text: jest.fn().mockResolvedValueOnce("Server Error"),
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
