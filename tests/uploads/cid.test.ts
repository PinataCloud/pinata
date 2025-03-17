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

const DATE = new Date().toISOString();

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
		date_queued: DATE,
		keyvalues: {},
		host_nodes: [],
		group_id: null,
	};

	it("should pin CID successfully", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({
				data: {
					id: "testId",
					cid: "QmTest123",
					name: "test.txt",
					status: "prechecking",
					date_queued: DATE,
					keyvalues: {},
					host_nodes: [],
					group_id: null,
				},
			}),
		});

		const result = await uploadCid(mockConfig, mockCid);

		expect(result).toEqual(mockResponse);
		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/v3/files/public/pin_by_cid",
			expect.objectContaining({
				method: "POST",
				headers: {
					Source: "sdk/cid",
					Authorization: "Bearer test-jwt",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					cid: mockCid,
					name: mockCid,
					keyvalues: undefined,
					group_id: undefined,
					host_nodes: undefined,
				}),
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
				data: {
					id: "testId",
					cid: "QmTest123",
					name: "Custom File Name",
					status: "prechecking",
					date_queued: DATE,
					keyvalues: { key1: "value1" },
					host_nodes: ["peer1", "peer2"],
					group_id: "test-group",
				},
			}),
		});

		await uploadCid(mockConfig, mockCid, mockOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/v3/files/public/pin_by_cid",
			expect.objectContaining({
				method: "POST",
				headers: {
					Source: "sdk/cid",
					Authorization: "Bearer test-jwt",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					cid: mockCid,
					name: "Custom File Name",
					keyvalues: mockMetadata.keyvalues,
					group_id: mockOptions.groupId,
					host_nodes: mockOptions.peerAddresses,
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
				data: {
					id: "testId",
					cid: "QmTest123",
					name: mockCid,
					status: "prechecking",
					date_queued: DATE,
					keyvalues: {},
					host_nodes: [],
					group_id: null,
				},
			}),
		});

		await uploadCid(mockConfig, mockCid, mockOptions);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/v3/files/public/pin_by_cid",
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
			url: "https://api.pinata.cloud/v3/files/public/pin_by_cid",
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
			url: "https://api.pinata.cloud/v3/files/public/pin_by_cid",
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
