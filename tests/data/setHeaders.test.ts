import { PinataSDK } from "../../src/core/pinataSDK";
import * as testAuthenticationModule from "../../src/core/authentication/testAuthentication";

jest.mock("../../src/core/authentication/testAuthentication");

describe("PinataSDK", () => {
	let pinata: PinataSDK;
	const mockTestAuthentication =
		testAuthenticationModule.testAuthentication as jest.MockedFunction<
			typeof testAuthenticationModule.testAuthentication
		>;

	beforeEach(() => {
		pinata = new PinataSDK({
			pinataJwt: "test_jwt",
			pinataGateway: "test.gateway.com",
		});
		mockTestAuthentication.mockClear();
	});

	describe("setNewHeaders", () => {
		it("should update custom headers", () => {
			const newHeaders = { "X-Custom-Header": "CustomValue" };
			pinata.setNewHeaders(newHeaders);

			// @ts-ignore: Accessing private property for testing
			expect(pinata.config.customHeaders).toEqual(newHeaders);
		});

		it("should merge new headers with existing ones", () => {
			const initialHeaders = { "Initial-Header": "InitialValue" };
			pinata.setNewHeaders(initialHeaders);

			const newHeaders = { "X-Custom-Header": "CustomValue" };
			pinata.setNewHeaders(newHeaders);

			// @ts-ignore: Accessing private property for testing
			expect(pinata.config.customHeaders).toEqual({
				"Initial-Header": "InitialValue",
				"X-Custom-Header": "CustomValue",
			});
		});

		it("should override existing headers with new ones", () => {
			const initialHeaders = { "X-Custom-Header": "InitialValue" };
			pinata.setNewHeaders(initialHeaders);

			const newHeaders = { "X-Custom-Header": "NewValue" };
			pinata.setNewHeaders(newHeaders);

			// @ts-ignore: Accessing private property for testing
			expect(pinata.config.customHeaders).toEqual(newHeaders);
		});

		it("should use updated headers in API calls", async () => {
			const newHeaders = { "X-Custom-Header": "CustomValue" };
			pinata.setNewHeaders(newHeaders);

			await pinata.testAuthentication();

			expect(mockTestAuthentication).toHaveBeenCalledWith(
				expect.objectContaining({
					customHeaders: newHeaders,
				}),
			);
		});
	});
});
