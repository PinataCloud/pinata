import { sendResumable } from "../../src/core/functions/uploads/resumable";
import { NetworkError } from "../../src/utils/custom-errors";

describe("sendResumable", () => {
	const originalFetch = global.fetch;
	afterEach(() => {
		global.fetch = originalFetch;
	});

	it("keeps the Retry-After of a lookup that can't say where the upload to continue stands", async () => {
		const resumeUrl = "https://uploads.test/v3/files/id/name";
		global.fetch = jest.fn(
			async () =>
				new Response(null, { status: 503, headers: { "Retry-After": "60" } }),
		) as unknown as typeof fetch;

		const error = await sendResumable(
			"https://uploads.test/v3/files/id",
			{},
			new File(["a"], "a.txt"),
			"filename YQ==",
			{ inline: true, resumeUrl },
		).catch((e) => e);

		expect(error).toBeInstanceOf(NetworkError);
		expect(error.statusCode).toBe(503);
		expect(error.details.metadata).toMatchObject({
			uploadUrl: resumeUrl,
			retryAfterMs: 60_000,
		});
	});
});
