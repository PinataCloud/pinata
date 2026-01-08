import { createPaymentInstruction } from "../../src/core/functions/x402/createPaymentInstruction";
import type {
	PinataConfig,
	CreatePaymentInstructionRequest,
	PaymentInstructionResponse,
} from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("createPaymentInstruction function", () => {
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

	const mockCreateRequest: CreatePaymentInstructionRequest = {
		name: "Test Payment Instruction",
		description: "A test payment instruction",
		payment_requirements: [
			{
				asset: "ETH",
				pay_to: "0x1234567890123456789012345678901234567890",
				network: "base",
				max_amount_required: "0.001",
				description: "Payment for access"
			}
		]
	};

	const mockPaymentInstructionResponse: PaymentInstructionResponse = {
		data: {
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
					description: "Payment for access"
				}
			],
			created_at: "2023-11-07T05:31:56Z"
		}
	};

	it("should create payment instruction successfully", async () => {
		const mockResponse = {
			ok: true,
			json: jest.fn().mockResolvedValue(mockPaymentInstructionResponse),
		};
		global.fetch = jest.fn().mockResolvedValue(mockResponse);

		const result = await createPaymentInstruction(mockConfig, mockCreateRequest);

		expect(fetch).toHaveBeenCalledWith(
			"https://api.pinata.cloud/v3/x402/payment_instructions",
			{
				method: "POST",
				headers: {
					Authorization: "Bearer test_jwt",
					"Content-Type": "application/json",
					Source: "sdk/createPaymentInstruction",
				},
				body: JSON.stringify(mockCreateRequest),
			},
		);
		expect(result).toEqual(mockPaymentInstructionResponse);
	});

	it("should throw ValidationError if config is missing", async () => {
		await expect(createPaymentInstruction(undefined, mockCreateRequest)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw ValidationError if name is missing", async () => {
		const invalidRequest = { ...mockCreateRequest, name: "" };

		await expect(createPaymentInstruction(mockConfig, invalidRequest)).rejects.toThrow(
			ValidationError,
		);
	});

	it("should throw ValidationError if payment requirements are missing", async () => {
		const invalidRequest = { ...mockCreateRequest, payment_requirements: [] };

		await expect(createPaymentInstruction(mockConfig, invalidRequest)).rejects.toThrow(
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

		await expect(createPaymentInstruction(mockConfig, mockCreateRequest)).rejects.toThrow(
			AuthenticationError,
		);
	});

	it("should throw NetworkError on non-401 error response", async () => {
		const mockResponse = {
			ok: false,
			status: 400,
			text: jest.fn().mockResolvedValue("Bad Request"),
			url: "https://api.pinata.cloud/v3/x402/payment_instructions",
		};
		global.fetch = jest.fn().mockResolvedValue(mockResponse);

		await expect(createPaymentInstruction(mockConfig, mockCreateRequest)).rejects.toThrow(
			NetworkError,
		);
	});

	it("should throw PinataError on fetch failure", async () => {
		global.fetch = jest
			.fn()
			.mockRejectedValue(new Error("Network failure"));

		await expect(createPaymentInstruction(mockConfig, mockCreateRequest)).rejects.toThrow(
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
			json: jest.fn().mockResolvedValue(mockPaymentInstructionResponse),
		};
		global.fetch = jest.fn().mockResolvedValue(mockResponse);

		await createPaymentInstruction(customConfig, mockCreateRequest);

		expect(fetch).toHaveBeenCalledWith(
			"https://custom-api.pinata.cloud/x402/payment_instructions",
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
			json: jest.fn().mockResolvedValue(mockPaymentInstructionResponse),
		};
		global.fetch = jest.fn().mockResolvedValue(mockResponse);

		await createPaymentInstruction(customConfig, mockCreateRequest);

		expect(fetch).toHaveBeenCalledWith(
			expect.any(String),
			{
				method: "POST",
				headers: {
					Authorization: "Bearer test_jwt",
					"Content-Type": "application/json",
					"Custom-Header": "custom-value",
				},
				body: JSON.stringify(mockCreateRequest),
			},
		);
	});
});