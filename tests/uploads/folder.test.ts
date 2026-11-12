import { uploadFolder } from "../../src/core/functions";
import type { FolderUploadEvent, PinataConfig } from "../../src";
import {
	FolderUploadError,
	ValidationError,
} from "../../src/utils/custom-errors";

const config: PinataConfig = {
	pinataJwt: "test-jwt",
	uploadUrl: "https://uploads.test/v3",
};

const file = (content: string, name = "f.txt", relativePath?: string) => {
	const f = new File([content], name, { type: "text/plain" });
	if (relativePath) {
		Object.defineProperty(f, "webkitRelativePath", { value: relativePath });
	}
	return f;
};

const encode = (value: string) => Buffer.from(value, "utf8").toString("base64");
const decodeMetadata = (header: string) =>
	Object.fromEntries(
		header.split(",").map((pair) => {
			const [key, value = ""] = pair.split(" ");
			return [key, Buffer.from(value, "base64").toString("utf8")];
		}),
	);

type Creation = { path: string; folderId: string };
type Answer = Response | undefined;

// A server for folder uploads: a creation request with the body registers the file at once
// unless `answer` says otherwise; sync reports every registered file.
const server = (
	answer: (creation: Creation, n: number) => Answer = () => undefined,
) => {
	const registered: string[] = [];
	const created: Creation[] = [];
	const events: string[] = [];
	let n = 0;
	const fetchMock = jest.fn(async (url: string, init: RequestInit) => {
		const headers = init.headers as Record<string, string>;
		if (init.method === "PUT") {
			const folderId = url.split("/buckets/")[1].split("/")[0];
			return new Response(
				JSON.stringify({
					data: {
						id: folderId,
						name: registered[0]?.split("/")[0],
						cid: "bafyfolder",
						size: 1,
						number_of_files: registered.length,
						network: "private",
						mime_type: "directory",
						created_at: "2026-11-12T00:00:00.000Z",
					},
				}),
				{ status: 200 },
			);
		}
		const folderId = url.split("/files/")[1].split("?")[0];
		const path = decodeMetadata(headers["Upload-Metadata"]).filename;
		const creation = { path, folderId };
		created.push(creation);
		events.push(`create ${path}`);
		const response = answer(creation, n++);
		if (response) return response;
		registered.push(path);
		events.push(`registered ${path}`);
		return new Response(null, {
			status: 201,
			headers: {
				Location: `https://uploads.test/v3/files/${folderId}/${encodeURIComponent(path)}`,
				"Upload-Offset": headers["Upload-Length"],
				"Upload-Cid": `bafy-${encodeURIComponent(path)}`,
				"Upload-Metadata": `filename ${encode(path)},file_id ${encode(folderId)},cid ${encode(`bafy-${path}`)}`,
			},
		});
	});
	global.fetch = fetchMock as unknown as typeof fetch;
	return { fetchMock, created, registered, events };
};

const refused = (status: number, message: string) =>
	new Response(JSON.stringify({ error: { code: status, message } }), {
		status,
	});

describe("uploadFolder", () => {
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

	describe("paths", () => {
		it("keeps the folder of an <input webkitdirectory> selection", async () => {
			const { created } = server();
			const result = await uploadFolder(
				config,
				[
					file("a", "a.txt", "photos/a.txt"),
					file("b", "b.jpg", "photos/2024/動画 b.jpg"),
				],
				"private",
			);

			expect(created.map((c) => c.path).sort()).toEqual([
				"photos/2024/動画 b.jpg",
				"photos/a.txt",
			]);
			expect(result.files.map((f) => f.path)).toEqual([
				"photos/a.txt",
				"photos/2024/動画 b.jpg",
			]);
		});

		it("renames the folder to the given name", async () => {
			const { created } = server();
			await uploadFolder(
				config,
				[
					{ path: "photos/a.txt", file: file("a") },
					{ path: "photos/b/c.txt", file: file("c") },
				],
				"private",
				{ metadata: { name: "album" } },
			);

			expect(created.map((c) => c.path).sort()).toEqual([
				"album/a.txt",
				"album/b/c.txt",
			]);
		});

		it("puts files without a shared folder under the name, or a default", async () => {
			const { created } = server();
			await uploadFolder(
				config,
				[
					{ path: "a.txt", file: file("a") },
					{ path: "sub\\b.txt", file: file("b") },
				],
				"private",
			);

			expect(created.map((c) => c.path).sort()).toEqual([
				"folder_from_sdk/a.txt",
				"folder_from_sdk/sub/b.txt",
			]);
		});

		it("refuses two files with one path and paths leaving the folder", async () => {
			server();
			await expect(
				uploadFolder(
					config,
					[
						{ path: "d/a.txt", file: file("a") },
						{ path: "d/a.txt", file: file("b") },
					],
					"private",
				),
			).rejects.toThrow(ValidationError);
			await expect(
				uploadFolder(
					config,
					[{ path: "d/../a.txt", file: file("a") }],
					"private",
				),
			).rejects.toThrow(ValidationError);
			await expect(uploadFolder(config, [], "private")).rejects.toThrow(
				ValidationError,
			);
		});

		it("refuses a folder name that is not one path segment", async () => {
			const { created } = server();
			for (const name of ["..", ".", "a/b", "a\\b", "..\\x", "100%"]) {
				await expect(
					uploadFolder(
						config,
						[{ path: "a.txt", file: file("a") }],
						"private",
						{
							metadata: { name },
						},
					),
				).rejects.toThrow(ValidationError);
			}
			expect(created).toHaveLength(0);
		});
	});

	it("registers one file before sending the others, then returns the synced folder", async () => {
		const { events, created, fetchMock } = server();
		const result = await uploadFolder(
			config,
			[
				{ path: "d/large.txt", file: file("large content") },
				{ path: "d/s.txt", file: file("s") },
				{ path: "d/m.txt", file: file("mm") },
			],
			"private",
		);

		// The smallest file creates the folder, alone
		expect(events.slice(0, 2)).toEqual([
			"create d/s.txt",
			"registered d/s.txt",
		]);
		// Every file goes into the same folder
		expect(new Set(created.map((c) => c.folderId)).size).toBe(1);
		expect(created[0].folderId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
		const sync = fetchMock.mock.calls.at(-1) as unknown as [
			string,
			RequestInit,
		];
		expect(sync[0]).toBe(
			`https://uploads.test/v3/buckets/${created[0].folderId}/sync`,
		);
		expect(result).toMatchObject({
			id: created[0].folderId,
			name: "d",
			cid: "bafyfolder",
			number_of_files: 3,
			network: "private",
		});
		expect(result.files).toEqual([
			{
				path: "d/large.txt",
				size: 13,
				cid: `bafy-${encodeURIComponent("d/large.txt")}`,
			},
			{
				path: "d/s.txt",
				size: 1,
				cid: `bafy-${encodeURIComponent("d/s.txt")}`,
			},
			{
				path: "d/m.txt",
				size: 2,
				cid: `bafy-${encodeURIComponent("d/m.txt")}`,
			},
		]);
	});

	it("sends no more files at once than the concurrency", async () => {
		let active = 0;
		let peak = 0;
		const entries = Array.from({ length: 12 }, (_, i) => ({
			path: `d/f${i}.txt`,
			file: file(`${i}`),
		}));
		const { fetchMock } = server();
		const respond = fetchMock.getMockImplementation() as (
			url: string,
			init: RequestInit,
		) => Promise<Response>;
		fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
			active++;
			peak = Math.max(peak, active);
			await new Promise((resolve) => setImmediate(resolve));
			active--;
			return respond(url, init);
		});

		await uploadFolder(config, entries, "private", { concurrency: 3 });

		expect(peak).toBe(3);
	});

	it("retries a file after a transient failure and reports each step", async () => {
		server((creation, n) =>
			creation.path === "d/b.txt" && n < 3
				? refused(503, "Upload service at write capacity")
				: undefined,
		);
		const events: FolderUploadEvent[] = [];

		const result = await uploadFolder(
			config,
			[
				{ path: "d/a.txt", file: file("a") },
				{ path: "d/b.txt", file: file("bb") },
			],
			"private",
			{ onProgress: (event) => events.push(event) },
		);

		expect(result.number_of_files).toBe(2);
		const forB = events.filter((e) => e.path === "d/b.txt");
		expect(forB.map((e) => `${e.type} ${e.attempt}`)).toEqual([
			"start 1",
			"retry 1",
			"start 2",
			"retry 2",
			"start 3",
			"complete 3",
		]);
		expect(forB[1].error?.message).toBe(
			"Could not start the upload (HTTP 503): Upload service at write capacity",
		);
		expect(events.at(-1)).toMatchObject({ completed: 2, failed: 0, total: 2 });
	});

	it("goes on without a file that fails for good, then reports which files failed", async () => {
		const { fetchMock } = server((creation) =>
			creation.path === "d/bad.txt" ? refused(400, "invalid name") : undefined,
		);

		const error = await uploadFolder(
			config,
			[
				{ path: "d/a.txt", file: file("a") },
				{ path: "d/bad.txt", file: file("bad") },
				{ path: "d/c.txt", file: file("cc") },
			],
			"private",
		).catch((e) => e);

		expect(error).toBeInstanceOf(FolderUploadError);
		expect(error.uploaded.map((f: { path: string }) => f.path).sort()).toEqual([
			"d/a.txt",
			"d/c.txt",
		]);
		expect(error.failed).toHaveLength(1);
		expect(error.failed[0].path).toBe("d/bad.txt");
		expect(error.failed[0].error.message).toBe(
			"Could not start the upload (HTTP 400): invalid name",
		);
		// Not retried, and the incomplete folder is not synced
		expect(
			fetchMock.mock.calls.filter(
				(call) => (call[1] as RequestInit).method === "PUT",
			),
		).toHaveLength(0);
	});

	it("ignores what onProgress throws", async () => {
		const { created } = server((creation) =>
			creation.path === "d/bad.txt" ? refused(400, "invalid name") : undefined,
		);
		const events: string[] = [];

		const error = await uploadFolder(
			config,
			[
				{ path: "d/a.txt", file: file("a") },
				{ path: "d/b.txt", file: file("bb") },
				{ path: "d/bad.txt", file: file("bad") },
			],
			"private",
			{
				onProgress: (event) => {
					events.push(`${event.type} ${event.path} ${event.completed}`);
					throw new Error("observer failed");
				},
			},
		).catch((e) => e);

		// Each file sent once: neither a registered file nor one whose start event threw
		// is sent again, and the failed file is reported as the folder's failure
		expect(created.map((c) => c.path).sort()).toEqual([
			"d/a.txt",
			"d/b.txt",
			"d/bad.txt",
		]);
		expect(error).toBeInstanceOf(FolderUploadError);
		expect(error.uploaded).toHaveLength(2);
		expect(error.failed.map((f: { path: string }) => f.path)).toEqual([
			"d/bad.txt",
		]);
		expect(events).toContain("complete d/b.txt 2");
		expect(events.filter((e) => e.startsWith("start"))).toHaveLength(3);
	});

	it("stops sending files after an authentication failure", async () => {
		const { created } = server((creation) =>
			creation.path === "d/a2.txt" ? refused(401, "Not Authorized") : undefined,
		);

		const error = await uploadFolder(
			config,
			[
				{ path: "d/a1.txt", file: file("1") },
				{ path: "d/a2.txt", file: file("22") },
				...Array.from({ length: 5 }, (_, i) => ({
					path: `d/later${i}.txt`,
					file: file("333"),
				})),
			],
			"private",
			{ concurrency: 1 },
		).catch((e) => e);

		expect(error).toBeInstanceOf(FolderUploadError);
		expect(error.failed).toHaveLength(6);
		expect(created.map((c) => c.path)).toEqual(["d/a1.txt", "d/a2.txt"]);
	});

	it("stops when the first files fail for a reason every file shares", async () => {
		const { created } = server(() =>
			refused(413, "Feature (Resumable Buckets) not turned on"),
		);

		await expect(
			uploadFolder(
				config,
				Array.from({ length: 6 }, (_, i) => ({
					path: `d/${i}.txt`,
					file: file("x".repeat(i + 1)),
				})),
				"private",
			),
		).rejects.toThrow(
			"Could not start the upload (HTTP 413): Feature (Resumable Buckets) not turned on",
		);
		// Three first files refused alike: the others are not sent
		expect(created).toHaveLength(3);
	});

	it("stops when the first file fails for any other reason", async () => {
		const { created } = server(() => refused(503, "Service Unavailable"));

		await expect(
			uploadFolder(
				config,
				[
					{ path: "d/a.txt", file: file("a") },
					{ path: "d/b.txt", file: file("bb") },
				],
				"private",
				{ retries: 1 },
			),
		).rejects.toThrow("HTTP 503");
		expect(created.map((c) => c.path)).toEqual(["d/a.txt", "d/a.txt"]);
	});

	it("lets the next file create the folder when the first is refused for its own reason", async () => {
		const { created } = server((creation) =>
			creation.path === "d/a.txt"
				? refused(400, "file with too many subdirectories")
				: undefined,
		);

		const error = await uploadFolder(
			config,
			[
				{ path: "d/a.txt", file: file("a") },
				{ path: "d/b.txt", file: file("bb") },
				{ path: "d/c.txt", file: file("ccc") },
			],
			"private",
		).catch((e) => e);

		expect(error).toBeInstanceOf(FolderUploadError);
		expect(error.failed.map((f: { path: string }) => f.path)).toEqual([
			"d/a.txt",
		]);
		expect(error.uploaded.map((f: { path: string }) => f.path).sort()).toEqual([
			"d/b.txt",
			"d/c.txt",
		]);
		expect(created.map((c) => c.path).slice(0, 2)).toEqual([
			"d/a.txt",
			"d/b.txt",
		]);
	});

	it("creates the folder with the smallest of the shallowest files", async () => {
		const { created } = server();

		await uploadFolder(
			config,
			[
				{ path: "d/x/y/tiny.txt", file: file("1") },
				{ path: "d/top.txt", file: file("1234") },
				{ path: "d/small.txt", file: file("12") },
			],
			"private",
		);

		expect(created[0].path).toBe("d/small.txt");
	});

	it("keeps a file reported as an earlier upload, with the CID of its own bytes", async () => {
		// Alone, the first file matches an earlier one-file folder: the server registers it
		// in this folder but reports the earlier upload's id and CID once it is ready
		const { fetchMock } = server(
			(creation) =>
				new Response(null, {
					status: 201,
					headers: {
						Location: `https://uploads.test/v3/files/${creation.folderId}/${encodeURIComponent(creation.path)}`,
						"Upload-Offset": "1",
						"Upload-Cid": `bafy-own-${creation.path}`,
						"Upload-Status": "processing",
					},
				}),
		);
		const realFetch = fetchMock.getMockImplementation() as (
			url: string,
			init: RequestInit,
		) => Promise<Response>;
		fetchMock.mockImplementation(async (url: string, init: RequestInit) =>
			init.method === "HEAD"
				? new Response(null, {
						status: 200,
						headers: {
							"Upload-Offset": "1",
							"Upload-Status": "ready",
							"Upload-Cid": "bafy-earlier-folder",
							"Upload-Metadata": `file_id ${encode("earlier-upload")}`,
						},
					})
				: init.method === "PUT"
					? new Response(
							JSON.stringify({
								data: {
									id: "f",
									name: "d",
									cid: "bafyfolder",
									size: 2,
									number_of_files: 2,
								},
							}),
							{ status: 200 },
						)
					: realFetch(url, init),
		);

		const result = await uploadFolder(
			config,
			[
				{ path: "d/a.txt", file: file("a") },
				{ path: "d/b.txt", file: file("b") },
			],
			"private",
		);

		expect(result.files.map((f) => f.cid)).toEqual([
			"bafy-own-d/a.txt",
			"bafy-own-d/b.txt",
		]);
	});

	it("answers with the earlier folder when the same content was already uploaded", async () => {
		const { fetchMock } = server();
		const realFetch = fetchMock.getMockImplementation() as (
			url: string,
			init: RequestInit,
		) => Promise<Response>;
		fetchMock.mockImplementation(async (url: string, init: RequestInit) =>
			init.method === "PUT"
				? new Response(
						JSON.stringify({
							data: {
								id: "earlier-folder",
								name: "photos",
								cid: "bafy-earlier",
								size: 3,
								number_of_files: 2,
								is_duplicate: true,
							},
						}),
						{ status: 200 },
					)
				: realFetch(url, init),
		);

		const result = await uploadFolder(
			config,
			[
				{ path: "v2/a.txt", file: file("a") },
				{ path: "v2/sub/b.txt", file: file("b") },
			],
			"public",
		);

		expect(result).toMatchObject({
			id: "earlier-folder",
			name: "photos",
			cid: "bafy-earlier",
			is_duplicate: true,
		});
		expect(result.files.map((f) => f.path)).toEqual([
			"photos/a.txt",
			"photos/sub/b.txt",
		]);
	});

	it("uses a JWT replaced during the upload for the next files", async () => {
		const { fetchMock } = server();
		const live: PinataConfig = { ...config, pinataJwt: "first-jwt" };

		await uploadFolder(
			live,
			[
				{ path: "d/a.txt", file: file("a") },
				{ path: "d/b.txt", file: file("bb") },
			],
			"private",
			{
				onProgress: (e) => {
					if (e.type === "complete") live.pinataJwt = "fresh-jwt";
				},
			},
		);

		const auth = (path: string) =>
			fetchMock.mock.calls
				.map(([, init]) => init.headers as Record<string, string>)
				.filter(
					(h) => decodeMetadata(h["Upload-Metadata"] ?? "").filename === path,
				)
				.map((h) => h.Authorization);
		expect(auth("d/a.txt")).toEqual(["Bearer first-jwt"]);
		expect(auth("d/b.txt")).toEqual(["Bearer fresh-jwt"]);
	});

	it("fails a file at once when the server refuses a chunk for good", async () => {
		let patches = 0;
		global.fetch = jest.fn(async (url: string, init: RequestInit) => {
			if (init.method === "POST") {
				return new Response(null, {
					status: 201,
					headers: { Location: `${url}/upload` },
				});
			}
			if (init.method === "PATCH") {
				patches++;
				return new Response("too large", { status: 413 });
			}
			return new Response(null, {
				status: 200,
				headers: { "Upload-Offset": "0" },
			});
		}) as unknown as typeof fetch;

		await expect(
			uploadFolder(
				config,
				[
					{
						path: "d/large.bin",
						file: new File([new Uint8Array(50 * 1024 * 1024 + 2)], "large.bin"),
					},
				],
				"public",
				{ retries: 0 },
			),
		).rejects.toThrow("too large");
		expect(patches).toBe(1);
	});

	it("stops at once when the registration check is refused", async () => {
		let heads = 0;
		global.fetch = jest.fn(async (url: string, init: RequestInit) => {
			if (init.method === "POST") {
				return new Response(null, {
					status: 201,
					headers: {
						Location: `${url}/upload`,
						"Upload-Offset": "1",
						"Upload-Cid": "bafyfile",
						"Upload-Status": "processing",
					},
				});
			}
			heads++;
			return new Response(null, { status: 401 });
		}) as unknown as typeof fetch;

		const error = await uploadFolder(
			config,
			[{ path: "d/a.txt", file: file("a") }],
			"public",
		).catch((e) => e);

		expect(error.statusCode).toBe(401);
		expect(heads).toBe(1);
	});

	it("fails a path holding '%' without sending it, and uploads the others", async () => {
		const { created } = server();
		const events: string[] = [];

		const error = await uploadFolder(
			config,
			[
				{ path: "d/100%.txt", file: file("a") },
				{ path: "d/ok.txt", file: file("bb") },
			],
			"private",
			{ onProgress: (e) => events.push(`${e.type} ${e.path} ${e.attempt}`) },
		).catch((e) => e);

		expect(error).toBeInstanceOf(FolderUploadError);
		expect(error.failed[0].error).toBeInstanceOf(ValidationError);
		expect(created.map((c) => c.path)).toEqual(["d/ok.txt"]);
		expect(events).toContain("error d/100%.txt 0");
	});

	it("checks a file's registration with a JWT replaced while it was being sent", async () => {
		const live: PinataConfig = { ...config, pinataJwt: "first-jwt" };
		global.fetch = jest.fn(async (url: string, init: RequestInit) => {
			const auth = (init.headers as Record<string, string>).Authorization;
			if (init.method === "POST") {
				// The token expires: the dashboard sets a fresh one
				live.pinataJwt = "fresh-jwt";
				return new Response(null, {
					status: 201,
					headers: {
						Location: `${url}/upload`,
						"Upload-Offset": "1",
						"Upload-Cid": "bafyfile",
						"Upload-Status": "processing",
					},
				});
			}
			if (init.method === "HEAD") {
				return auth === "Bearer fresh-jwt"
					? new Response(null, {
							status: 200,
							headers: {
								"Upload-Offset": "1",
								"Upload-Status": "ready",
								"Upload-Cid": "bafyfile",
							},
						})
					: new Response(null, { status: 401 });
			}
			return new Response(
				JSON.stringify({
					data: {
						id: "f",
						name: "d",
						cid: "bafyfolder",
						size: 1,
						number_of_files: 1,
					},
				}),
				{ status: 200 },
			);
		}) as unknown as typeof fetch;

		const result = await uploadFolder(
			live,
			[{ path: "d/a.txt", file: file("a") }],
			"public",
		);

		expect(result.files[0].cid).toBe("bafyfile");
	});

	it("refuses options a folder upload cannot honor", async () => {
		server();
		await expect(
			uploadFolder(config, [{ path: "d/a.txt", file: file("a") }], "public", {
				vectorize: true,
				waitForCid: false,
			}),
		).rejects.toThrow(
			"Folder uploads do not support: vectorize, waitForCid(false)",
		);
	});
});
