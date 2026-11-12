import {
	registrationTimeout,
	waitForRegistration,
} from "../../src/core/functions/uploads/tusStatus";
import { NetworkError } from "../../src/utils/custom-errors";

const MINUTE = 60 * 1000;

describe("registrationTimeout", () => {
	it("allows 10 minutes plus 5 minutes per started GiB", () => {
		expect(registrationTimeout(1)).toBe(15 * MINUTE);
		expect(registrationTimeout(1024 ** 3)).toBe(15 * MINUTE);
		expect(registrationTimeout(1024 ** 3 + 1)).toBe(20 * MINUTE);
		// 9.31 GiB: past the old 20-minute limit, inside the new 60-minute one
		expect(registrationTimeout(10_000_000_000)).toBe(60 * MINUTE);
	});
});

describe("waitForRegistration", () => {
	const originalFetch = global.fetch;
	afterEach(() => {
		global.fetch = originalFetch;
	});

	describe("on a fake clock", () => {
		let now: number;
		let clock: jest.SpyInstance;
		let timers: jest.SpyInstance;
		beforeEach(() => {
			now = 0;
			clock = jest.spyOn(Date, "now").mockImplementation(() => now);
			// Every pause between polls passes at once, but moves the clock
			timers = jest.spyOn(global, "setTimeout").mockImplementation(((
				callback: () => void,
				ms: number,
			) => {
				now += ms;
				callback();
				return 0;
			}) as unknown as typeof setTimeout);
		});
		afterEach(() => {
			clock.mockRestore();
			timers.mockRestore();
		});

		const url = "https://uploads.example/v3/files/id/name";
		const size = 10_000_000_000;
		// HEAD answers `processing` until the server registers the upload
		const serverReadyAt = (readyAt: number) => {
			const head = jest.fn(
				async () =>
					new Response(null, {
						status: 200,
						headers: {
							"Upload-Offset": size.toString(),
							...(now >= readyAt
								? { "Upload-Status": "ready", "Upload-Cid": "bafyregistered" }
								: { "Upload-Status": "processing" }),
						},
					}),
			);
			global.fetch = head as unknown as typeof fetch;
			return head;
		};

		it("waits long enough for a 10 GB upload that becomes ready after 35 minutes", async () => {
			serverReadyAt(35 * MINUTE);

			await expect(waitForRegistration(url, {}, size)).resolves.toBe(
				"bafyregistered",
			);
			expect(now).toBeGreaterThanOrEqual(35 * MINUTE);
		});

		it("times out after the allowance with the upload URL to keep polling", async () => {
			const head = serverReadyAt(Number.POSITIVE_INFINITY);

			const error = await waitForRegistration(url, {}, size).catch((e) => e);

			expect(error).toBeInstanceOf(NetworkError);
			expect(error.message).toContain("after 60 minutes");
			expect(error.message).toContain(`poll ${url} with HEAD`);
			expect(error.message).toContain("Upload-Status: ready");
			expect(error.details).toMatchObject({
				error: "upload still processing",
				code: "HTTP_ERROR",
				metadata: { requestUrl: url, timeoutMs: 60 * MINUTE },
			});
			expect(now).toBeLessThanOrEqual(60 * MINUTE);
			expect(now).toBeGreaterThan(59 * MINUTE);
			expect(head).toHaveBeenCalled();
		});
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
