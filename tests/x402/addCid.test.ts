import { addCid } from "../../src/core/functions/x402/addCid";
import type {
	PinataConfig,
	CidAssociationResponse,
} from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("addCid function", () => {
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

	const mockCidAssociationResponse: CidAssociationResponse = {
		data: {
			payment_instruction_id: "pi-1",
			cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
			created_at: "2023-11-07T05:31:56Z"
		}
	};

	it("should add CID successfully", async () => {
		const mockResponse = {
			ok: true,
			json: jest.fn().mockResolvedValue(mockCidAssociationResponse),
		};
		global.fetch = jest.fn().mockResolvedValue(mockResponse);

		const result = await addCid(mockConfig, "pi-1", "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");

		expect(fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/v3/x402/payment_instructions/pi-1/cids/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
			{
				method: "PUT",
				headers: {
					Authorization: "Bearer test_jwt",
					"Content-Type": "application/json",
					Source: "sdk/addCid",
				},
			},
		);
		expect(result).toEqual(mockCidAssociationResponse);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(addCid(undefined, "pi-1", "QmTest")).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw ValidationError if payment instruction ID is missing", async () => {
		await expect(addCid(mockConfig, "", "QmTest")).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw ValidationError if CID is missing", async () => {
		await expect(addCid(mockConfig, "pi-1", "")).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		const mockResponse = {
			ok: false,
			status: 401,
			text: jest.fn().mockResolvedValue("Unauthorized"),
			url: "https://api.pinata.cloud/v3/x402/payment_instructions/pi-1/cids/QmTest",
		};
		global.fetch = jest.fn().mockResolvedValue(mockResponse);

		await expect(addCid(mockConfig, "pi-1", "QmTest")).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		const mockResponse = {
			ok: false,
			status: 404,
			text: jest.fn().mockResolvedValue("Not Found"),
			url: "https://api.pinata.cloud/v3/x402/payment_instructions/pi-1/cids/QmTest",
		};
		global.fetch = jest.fn().mockResolvedValue(mockResponse);

		await expect(addCid(mockConfig, "pi-1", "QmTest")).rejects.toThrow(
			NetworkError,
		);
	});

	it("should throw PinataError on fetch failure", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValue(new Error("Network failure"));

		await expect(addCid(mockConfig, "pi-1", "QmTest")).rejects.toThrow(
			PinataError,
		);
	});

	it("should use custom endpoint if provided", async () => {
		const customConfig: PinataConfig = {
			...mockConfig,
			endpointUrl: "https://custom-api.pinata.cloud",
		};

		const mockResponse = {
			ok: true,
			json: jest.fn().mockResolvedValue(mockCidAssociationResponse),
		};
		global.fetch = jest.fn().mockResolvedValue(mockResponse);

		await addCid(customConfig, "pi-1", "QmTest");

		expect(fetch).toHaveBeenCalledWith(
			"https://custom-api.pinata.cloud/x402/payment_instructions/pi-1/cids/QmTest",
			expect.any(Object),
		);
	});

	it("should use custom headers if provided", async () => {
		const customConfig: PinataConfig = {
			...mockConfig,
			customHeaders: {
				"Custom-Header": "custom-value",
			},
		};

		const mockResponse = {
			ok: true,
			json: jest.fn().mockResolvedValue(mockCidAssociationResponse),
		};
		global.fetch = jest.fn().mockResolvedValue(mockResponse);

		await addCid(customConfig, "pi-1", "QmTest");

		expect(fetch).toHaveBeenCalledWith(
			expect.any(String),
			{
				method: "PUT",
				headers: {
					Authorization: "Bearer test_jwt",
					"Content-Type": "application/json",
					"Custom-Header": "custom-value",
				},
			},
		);
	});
});