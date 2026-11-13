// Regressions from the review of #105 (folder uploads): each test reproduces a defect.
import { uploadFolder } from "../../src/core/functions";
import type { FolderUploadEvent, PinataConfig } from "../../src";
import { FolderUploadError } from "../../src/utils/custom-errors";

const config: PinataConfig = {
	pinataJwt: "test-jwt",
	uploadUrl: "https://uploads.test/v3",
};

const file = (content: string, name = "f.txt") =>
	new File([content], name, { type: "text/plain" });

const decodeMetadata = (header: string) =>
	Object.fromEntries(
		header.split(",").map((pair) => {
			const [key, value = ""] = pair.split(" ");
			return [key, Buffer.from(value, "base64").toString("utf8")];
		}),
	);
const encode = (value: string) => Buffer.from(value, "utf8").toString("base64");

const synced = (files: number) =>
	new Response(
		JSON.stringify({
			data: {
				id: "f",
				name: "d",
				cid: "bafyfolder",
				size: 1,
				number_of_files: files,
			},
		}),
		{ status: 200 },
	);
const refused = (status: number, message: string) =>
	new Response(JSON.stringify({ error: { code: status, message } }), {
		status,
	});
const pathOf = (init: RequestInit) =>
	decodeMetadata((init.headers as Record<string, string>)["Upload-Metadata"])
		.filename;
// A creation that stores every byte and registers the file at once
const registered = (url: string, init: RequestInit) => {
	const headers = init.headers as Record<string, string>;
	const path = pathOf(init);
	return new Response(null, {
		status: 201,
		headers: {
			Location: `${url}/${encodeURIComponent(path)}`,
			"Upload-Offset": headers["Upload-Length"],
			"Upload-Cid": `bafy-${path}`,
		},
	});
};

describe("folder uploads, review of #105", () => {
	const originalFetch = global.fetch;
	let setTimeoutSpy: jest.SpyInstance;
	beforeEach(() => {
		setTimeoutSpy = jest.spyOn(global, "setTimeout").mockImplementation(((
			callback: () => void,
		) => {
			callback();
			return 0;
		}) as unknown as typeof setTimeout);
	});
	afterEach(() => {
		global.fetch = originalFetch;
		setTimeoutSpy.mockRestore();
	});

	it("never sends a file into the upload of another file refused the JWT", async () => {
		const live: PinataConfig = { ...config, pinataJwt: "J0" };
		const requests: string[] = [];
		global.fetch = jest.fn(async (url: string, init: RequestInit) => {
			const headers = init.headers as Record<string, string>;
			if (init.method === "PUT") return synced(2);
			if (init.method === "POST") {
				const path = pathOf(init);
				requests.push(`POST ${path} ${headers.Authorization}`);
				if (path === "d/0.txt") return registered(url, init);
				// The creation stores none of the body
				return new Response(null, {
					status: 201,
					headers: {
						Location: `https://u.test/up/${encodeURIComponent(path)}`,
						"Upload-Offset": "0",
					},
				});
			}
			requests.push(`${init.method} ${url} ${headers.Authorization}`);
			if (init.method === "HEAD") {
				return new Response(null, {
					status: 200,
					headers: { "Upload-Offset": "0" },
				});
			}
			if (headers.Authorization === "Bearer J0") {
				return refused(401, "Invalid/expired token");
			}
			const size = Number(headers["Upload-Offset"]) + (init.body as Blob).size;
			return new Response(null, {
				status: 204,
				headers: {
					"Upload-Offset": `${size}`,
					"Upload-Cid": `bafy-${decodeURIComponent(url.split("/up/")[1])}`,
				},
			});
		}) as unknown as typeof fetch;
		const events: string[] = [];

		const error = await uploadFolder(
			live,
			[
				{ path: "d/0.txt", file: file("0") },
				{ path: "d/a/aaaa.txt", file: file("aaaa") },
				{ path: "d/b/bbbbbb.txt", file: file("bbbbbb") },
			],
			"public",
			{
				concurrency: 1,
				onProgress: (e) => {
					events.push(`${e.type} ${e.path} ${e.attempt}`);
					// The caller sets a new JWT once A fails
					if (e.type === "error" && e.path === "d/a/aaaa.txt") {
						live.pinataJwt = "J1";
					}
				},
			},
		).catch((e) => e);

		const intoA = requests.filter(
			(r) => r.includes("/up/d%2Fa%2Faaaa.txt") && !r.startsWith("POST"),
		);
		// Only A's own refused PATCH ever went to A's upload
		expect(intoA).toEqual([
			"PATCH https://u.test/up/d%2Fa%2Faaaa.txt Bearer J0",
		]);
		// B was sent as itself, with the new JWT, or failed without being sent
		const b = error instanceof FolderUploadError ? error : undefined;
		const bUploaded = b?.uploaded.find((f) => f.path === "d/b/bbbbbb.txt");
		if (bUploaded) expect(bUploaded.cid).toBe("bafy-d/b/bbbbbb.txt");
		// No retry for a file without a start before it
		const bEvents = events.filter((e) => e.includes("d/b/bbbbbb.txt"));
		const firstStart = bEvents.findIndex((e) => e.startsWith("start"));
		const firstRetry = bEvents.findIndex((e) => e.startsWith("retry"));
		if (firstRetry >= 0) expect(firstStart).toBeGreaterThanOrEqual(0);
		if (firstRetry >= 0) expect(firstStart).toBeLessThan(firstRetry);
	});

	it("reports attempt 0, and no retry, for a file never sent", async () => {
		// The JWT is refused for good: the files after the first refusal are never sent
		global.fetch = jest.fn(async (url: string, init: RequestInit) => {
			if (init.method === "PUT") return synced(1);
			return pathOf(init) === "d/0.txt"
				? registered(url, init)
				: refused(401, "Invalid/expired token");
		}) as unknown as typeof fetch;
		const events: FolderUploadEvent[] = [];

		const error = await uploadFolder(
			config,
			[
				{ path: "d/0.txt", file: file("0") },
				{ path: "d/a.txt", file: file("aa") },
				{ path: "d/b.txt", file: file("bbb") },
				{ path: "d/c.txt", file: file("cccc") },
			],
			"public",
			{ concurrency: 1, onProgress: (e) => events.push(e) },
		).catch((e) => e);

		expect(error).toBeInstanceOf(FolderUploadError);
		for (const path of ["d/b.txt", "d/c.txt"]) {
			const own = events.filter((e) => e.path === path);
			expect(own.map((e) => `${e.type} ${e.attempt}`)).toEqual(["error 0"]);
		}
	});

	it("names the folder on its error, and a re-send of failed[].path lands under it", async () => {
		const created: string[] = [];
		let refuseB = true;
		global.fetch = jest.fn(async (url: string, init: RequestInit) => {
			if (init.method === "PUT") return synced(created.length);
			const path = pathOf(init);
			if (path.endsWith("docs/b.txt") && refuseB) {
				return refused(400, "invalid name");
			}
			created.push(path);
			return registered(url, init);
		}) as unknown as typeof fetch;
		// No shared top directory: the folder gets the default name
		const files = [
			{ path: "a.txt", file: file("a") },
			{ path: "docs/b.txt", file: file("bb") },
		];

		const error = await uploadFolder(config, files, "public").catch((e) => e);

		expect(error).toBeInstanceOf(FolderUploadError);
		expect(error.folderName).toBe("folder_from_sdk");
		refuseB = false;
		await uploadFolder(
			config,
			error.failed.map((f: { index: number; path: string }) => ({
				path: f.path,
				file: files[f.index].file,
			})),
			"public",
			{ folderId: error.folderId },
		);
		expect(created).toEqual([
			"folder_from_sdk/a.txt",
			"folder_from_sdk/docs/b.txt",
		]);
	});

	it("rejects a folder of several files whose sync answers 404, even if one file matched an earlier folder", async () => {
		global.fetch = jest.fn(async (url: string, init: RequestInit) => {
			if (init.method === "PUT") {
				return refused(404, "bucket not found");
			}
			const path = pathOf(init);
			const response = registered(url, init);
			if (path === "d/a.txt") {
				response.headers.set(
					"Upload-Metadata",
					`filename ${encode("d")},file_id ${encode("earlier")},cid ${encode("bafyearlier")}`,
				);
			}
			return response;
		}) as unknown as typeof fetch;

		await expect(
			uploadFolder(
				config,
				[
					{ path: "d/a.txt", file: file("a") },
					{ path: "d/b.txt", file: file("bb") },
					{ path: "d/c.txt", file: file("ccc") },
				],
				"public",
			),
		).rejects.toThrow("Could not finish the folder (HTTP 404)");
	});

	it("falls back to the default retries and concurrency when they are not finite", async () => {
		let creations = 0;
		let active = 0;
		let peak = 0;
		global.fetch = jest.fn(async (url: string, init: RequestInit) => {
			if (init.method === "PUT") return synced(12);
			creations++;
			if (creations <= 1000 && pathOf(init) === "d/never.txt") {
				return refused(503, "busy");
			}
			active++;
			peak = Math.max(peak, active);
			await new Promise((resolve) => setImmediate(resolve));
			active--;
			return registered(url, init);
		}) as unknown as typeof fetch;

		const error = await uploadFolder(
			config,
			[
				{ path: "d/a.txt", file: file("a") },
				...Array.from({ length: 10 }, (_, i) => ({
					path: `d/x${i}.txt`,
					file: file(`xx${i}`),
				})),
				{ path: "d/never.txt", file: file("never-ever") },
			],
			"public",
			{ retries: Number.NaN, concurrency: Number.NaN },
		).catch((e) => e);

		expect(error).toBeInstanceOf(FolderUploadError);
		// 1 attempt + 3 retries (the default) for the file that always gets 503
		expect(
			(global.fetch as jest.Mock).mock.calls.filter(
				([, init]) => init.method === "POST" && pathOf(init) === "d/never.txt",
			),
		).toHaveLength(4);
		expect(peak).toBeLessThanOrEqual(4);
	});
});
