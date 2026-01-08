import { listPaymentInstructions } from "../../src/core/functions/x402/listPaymentInstructions";
import type {
	PinataConfig,
	PaymentInstructionListQuery,
	PaymentInstructionListResponse,
} from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("listPaymentInstructions function", () => {
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

	const mockPaymentInstructionsResponse: PaymentInstructionListResponse = {
		data: {
			payment_instructions: [
				{
					id: "pi-1",
					version: 1,
					name: "Test Payment Instruction",
					description: "A test payment instruction",
					payment_requirements: [
						{
							asset: "ETH",
							pay_to: "0x1234567890123456789012345678901234567890",
							network: "base",
							max_amount_required: "0.001",
							description: "Payment for access",
						},
					],
					created_at: "2023-11-07T05:31:56Z",
				},
			],
			next_page_token: "next_token",
		},
	};

	it("should list payment instructions successfully without options", async () => {
		const mockResponse = {
			ok: true,
			json: jest.fn().mockResolvedValue(mockPaymentInstructionsResponse),
		};
		global.fetch = jest.fn().mockResolvedValue(mockResponse);

		const result = await listPaymentInstructions(mockConfig);

		expect(fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/v3/x402/payment_instructions?",
			{
				method: "GET",
				headers: {
					Authorization: "Bearer test_jwt",
					"Content-Type": "application/json",
					Source: "sdk/listPaymentInstructions",
				},
			},
		);
		expect(result).toEqual(mockPaymentInstructionsResponse);
	});

	it("should handle all query parameters correctly", async () => {
		const mockResponse = {
			ok: true,
			json: jest.fn().mockResolvedValue(mockPaymentInstructionsResponse),
		};
		global.fetch = jest.fn().mockResolvedValue(mockResponse);

		const options: PaymentInstructionListQuery = {
			limit: 10,
			pageToken: "token123",
			cid: "QmTest",
			name: "test",
			id: "pi-1",
		};

		await listPaymentInstructions(mockConfig, options);

		expect(fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/v3/x402/payment_instructions?pageToken=token123&limit=10&cid=QmTest&name=test&id=pi-1",
			{
				method: "GET",
				headers: {
					Authorization: "Bearer test_jwt",
					"Content-Type": "application/json",
					Source: "sdk/listPaymentInstructions",
				},
			},
		);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(listPaymentInstructions(undefined)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw AuthenticationError on 401 response", async () => {
		const mockResponse = {
			ok: false,
			status: 401,
			text: jest.fn().mockResolvedValue("Unauthorized"),
			url: "https://api.pinata.cloud/v3/x402/payment_instructions",
		};
		global.fetch = jest.fn().mockResolvedValue(mockResponse);

		await expect(listPaymentInstructions(mockConfig)).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		const mockResponse = {
			ok: false,
			status: 404,
			text: jest.fn().mockResolvedValue("Not Found"),
			url: "https://api.pinata.cloud/v3/x402/payment_instructions",
		};
		global.fetch = jest.fn().mockResolvedValue(mockResponse);

		await expect(listPaymentInstructions(mockConfig)).rejects.toThrow(
			NetworkError,
		);
	});

	it("should throw PinataError on fetch failure", async () => {
		global.fetch = jest.fn().mockRejectedValue(new Error("Network failure"));

		await expect(listPaymentInstructions(mockConfig)).rejects.toThrow(
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
			json: jest.fn().mockResolvedValue(mockPaymentInstructionsResponse),
		};
		global.fetch = jest.fn().mockResolvedValue(mockResponse);

		await listPaymentInstructions(customConfig);

		expect(fetch).toHaveBeenCalledWith(
			"https://custom-api.pinata.cloud/x402/payment_instructions?",
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
			json: jest.fn().mockResolvedValue(mockPaymentInstructionsResponse),
		};
		global.fetch = jest.fn().mockResolvedValue(mockResponse);

		await listPaymentInstructions(customConfig);

		expect(fetch).toHaveBeenCalledWith(expect.any(String), {
			method: "GET",
			headers: {
				Authorization: "Bearer test_jwt",
				"Content-Type": "application/json",
				"Custom-Header": "custom-value",
			},
		});
	});
});
