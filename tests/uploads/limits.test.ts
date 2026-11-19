import { PinataSDK } from "../../src";
import { AuthenticationError } from "../../src/utils/custom-errors";

describe("upload.limits()", () => {
	const originalFetch = global.fetch;
	afterEach(() => {
		global.fetch = originalFetch;
	});

	const answer = (status: number, body: unknown) => {
		const fetchMock = jest.fn(
			async () => new Response(JSON.stringify(body), { status }),
		);
		global.fetch = fetchMock as unknown as typeof fetch;
		return fetchMock;
	};

	it("answers the account's limits from GET /v3/files/limits on the upload server", async () => {
		const fetchMock = answer(200, { data: { folder_max_files: 60000 } });
		const pinata = new PinataSDK({ pinataJwt: "test-jwt" });

		expect(await pinata.upload.limits()).toEqual({ folder_max_files: 60000 });
		expect(fetchMock).toHaveBeenCalledWith(
			"https://uploads.pinata.cloud/v3/files/limits",
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({ Authorization: "Bearer test-jwt" }),
			}),
		);
	});

	it("rejects with an AuthenticationError when the JWT is refused", async () => {
		answer(401, { error: { code: 401, message: "Not Authorized" } });
		const pinata = new PinataSDK({ pinataJwt: "bad-jwt" });

		const error = await pinata.upload.limits().catch((e) => e);

		expect(error).toBeInstanceOf(AuthenticationError);
		expect(error.statusCode).toBe(401);
	});
});
