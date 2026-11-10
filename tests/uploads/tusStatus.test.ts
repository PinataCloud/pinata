import { waitForRegistration } from "../../src/core/functions/uploads/tusStatus";

describe("waitForRegistration", () => {
	const originalFetch = global.fetch;
	afterEach(() => {
		global.fetch = originalFetch;
	});

	it("stops polling as soon as its signal aborts", async () => {
		const head = jest.fn(
			async () =>
				new Response(null, {
					status: 200,
					headers: { "Upload-Offset": "10", "Upload-Status": "processing" },
				}),
		);
		global.fetch = head as unknown as typeof fetch;
		const controller = new AbortController();

		const waiting = waitForRegistration(
			"https://uploads.example/v3/files/id/name",
			{},
			10,
			controller.signal,
		);
		// Aborted during the first pause between polls (1 s), before any HEAD.
		controller.abort(new Error("cancelled"));

		await expect(waiting).rejects.toThrow("cancelled");
		expect(head).not.toHaveBeenCalled();
	});
});
