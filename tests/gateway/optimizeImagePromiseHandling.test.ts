import { PinataSDK } from "../../src/core/pinataSDK";
import type { PinataConfig } from "../../src/core/types";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("OptimizeImage Promise Handling", () => {
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

	describe("OptimizeImageGetCid", () => {
		it("should properly handle promise rejections when content is not pinned", async () => {
			// Mock a 404 response to simulate content not being pinned
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 404,
				text: jest.fn().mockResolvedValueOnce("Not Found"),
			});

			const pinata = new PinataSDK(mockConfig);
			const cid = "QmcUNH54shLGC8tmkzt7ounwFc2W2bg3xLqbmdq5wHHj7R";

			let errorCaught = false;
			let errorMessage = "";

			try {
				await pinata.gateways.public.get(cid);
			} catch (error) {
				errorCaught = true;
				errorMessage = error instanceof Error ? error.message : String(error);
			}

			expect(errorCaught).toBe(true);
			expect(errorMessage).toContain("HTTP error");
		});

		it("should properly handle promise rejections with .then() and .catch()", async () => {
			// Mock a 404 response to simulate content not being pinned
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 404,
				text: jest.fn().mockResolvedValueOnce("Not Found"),
			});

			const pinata = new PinataSDK(mockConfig);
			const cid = "QmcUNH54shLGC8tmkzt7ounwFc2W2bg3xLqbmdq5wHHj7R";

			let tryBlockExecuted = false;
			let catchBlockExecuted = false;
			let doneBlockExecuted = false;
			let errorBlockExecuted = false;

			try {
				await pinata.gateways.public.get(cid);
				tryBlockExecuted = true;
			} catch {
				catchBlockExecuted = true;
			}

			// Test the promise chain behavior
			await pinata.gateways.public
				.get(cid)
				.then(() => {
					doneBlockExecuted = true;
				})
				.catch(() => {
					errorBlockExecuted = true;
				});

			expect(tryBlockExecuted).toBe(false);
			expect(catchBlockExecuted).toBe(true);
			expect(doneBlockExecuted).toBe(false);
			expect(errorBlockExecuted).toBe(true);
		});

		it("should properly handle promise rejections with image optimization", async () => {
			// Mock a 404 response to simulate content not being pinned
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 404,
				text: jest.fn().mockResolvedValueOnce("Not Found"),
			});

			const pinata = new PinataSDK(mockConfig);
			const cid = "QmcUNH54shLGC8tmkzt7ounwFc2W2bg3xLqbmdq5wHHj7R";

			let errorCaught = false;

			try {
				await pinata.gateways.public
					.get(cid)
					.optimizeImage({ width: 100, height: 100 });
			} catch (error) {
				errorCaught = true;
			}

			expect(errorCaught).toBe(true);
		});

		it("should properly handle authentication errors", async () => {
			// Mock a 401 response to simulate authentication error
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: jest.fn().mockResolvedValueOnce("Unauthorized"),
			});

			const pinata = new PinataSDK(mockConfig);
			const cid = "QmcUNH54shLGC8tmkzt7ounwFc2W2bg3xLqbmdq5wHHj7R";

			let errorCaught = false;
			let isAuthenticationError = false;

			try {
				await pinata.gateways.public.get(cid);
			} catch (error) {
				errorCaught = true;
				isAuthenticationError = error instanceof AuthenticationError;
			}

			expect(errorCaught).toBe(true);
			expect(isAuthenticationError).toBe(true);
		});
	});

	describe("OptimizeImageCreateAccessLink", () => {
		it("should properly handle promise rejections", async () => {
			// Mock a 401 response to simulate authentication error
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: jest.fn().mockResolvedValueOnce("Unauthorized"),
			});

			const pinata = new PinataSDK(mockConfig);
			const options = {
				cid: "QmcUNH54shLGC8tmkzt7ounwFc2W2bg3xLqbmdq5wHHj7R",
				expires: 3600,
			};

			let errorCaught = false;
			let isAuthenticationError = false;

			try {
				await pinata.gateways.private.createAccessLink(options);
			} catch (error) {
				errorCaught = true;
				isAuthenticationError = error instanceof AuthenticationError;
			}

			expect(errorCaught).toBe(true);
			expect(isAuthenticationError).toBe(true);
		});

		it("should properly handle promise rejections with image optimization", async () => {
			// Mock a 401 response to simulate authentication error
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: jest.fn().mockResolvedValueOnce("Unauthorized"),
			});

			const pinata = new PinataSDK(mockConfig);
			const options = {
				cid: "QmcUNH54shLGC8tmkzt7ounwFc2W2bg3xLqbmdq5wHHj7R",
				expires: 3600,
			};

			let errorCaught = false;

			try {
				await pinata.gateways.private
					.createAccessLink(options)
					.optimizeImage({ width: 100, height: 100 });
			} catch (error) {
				errorCaught = true;
			}

			expect(errorCaught).toBe(true);
		});
	});
}); 