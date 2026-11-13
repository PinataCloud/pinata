import { uploadFolder } from "../../src/core/functions";
import type { FolderUploadEvent, PinataConfig } from "../../src";
import { PublicUpload } from "../../src/core/classes/uploads/PublicUpload";
import {
	FolderUploadError,
	ValidationError,
} from "../../src/utils/custom-errors";
import { NodeLikeFile } from "./nodeLikeFile";

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

// The size of a resumable upload's chunk, and a file just over one chunk
const CHUNK = 50 * 1024 * 1024 + 1;
const big = () =>
	new File([new Uint8Array(CHUNK + 1)], "big.bin", {
		type: "application/octet-stream",
	});
const pathOf = (init: RequestInit) =>
	decodeMetadata((init.headers as Record<string, string>)["Upload-Metadata"])
		.filename;
// A creation that stores every byte and registers the file at once
const registeredAt = (url: string, init: RequestInit) => {
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
// The folder sync's answer: a folder holding `files` files
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
// Each JWT is accepted `uses` times, then refused (401); refreshJwt hands out the next one
const expiring = (uses: number) => {
	const used = new Map<string, number>();
	let issued = 1;
	return {
		config: { ...config, pinataJwt: "t1" },
		refreshJwt: jest.fn(async () => `t${++issued}`),
		accepts: (headers: Record<string, string>) => {
			const jwt = headers.Authorization.replace("Bearer ", "");
			const n = (used.get(jwt) ?? 0) + 1;
			used.set(jwt, n);
			return n <= uses;
		},
	};
};

describe("uploadFolder", () => {
	const originalFetch = global.fetch;
	// Every pause passes at once; `delays` records how long each would have been
	let delays: number[];
	let setTimeoutSpy: jest.SpyInstance;
	beforeEach(() => {
		delays = [];
		setTimeoutSpy = jest.spyOn(global, "setTimeout").mockImplementation(((
			callback: () => void,
			ms: number,
		) => {
			delays.push(ms);
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

		it("tells files apart by their position, whatever their path", async () => {
			const { created } = server((creation) =>
				creation.path === "d/back\\slash.txt"
					? refused(400, "invalid file path")
					: undefined,
			);
			const events: FolderUploadEvent[] = [];

			const error = await uploadFolder(
				config,
				[
					file("a", "a.txt", "d/a.txt"),
					// A File's path never uses "\\" as separator: it is part of the name
					file("b", "back\\slash.txt", "d/back\\slash.txt"),
				],
				"public",
				{ onProgress: (event) => events.push(event) },
			).catch((e) => e);

			expect(created.map((c) => c.path)).toEqual([
				"d/a.txt",
				"d/back\\slash.txt",
			]);
			expect(events.map((e) => `${e.type} ${e.index}`)).toEqual([
				"start 0",
				"sent 0",
				"complete 0",
				"start 1",
				"error 1",
			]);
			expect(error.uploaded.map((f: { index: number }) => f.index)).toEqual([
				0,
			]);
			expect(error.failed.map((f: { index: number }) => f.index)).toEqual([1]);
		});

		it("reads '\\' in an entry's path as a separator (a Windows path)", async () => {
			const { created } = server();

			const result = await uploadFolder(
				config,
				[{ path: "d\\sub\\a.txt", file: file("a") }],
				"public",
			);

			expect(created.map((c) => c.path)).toEqual(["d/sub/a.txt"]);
			expect(result.files[0]).toMatchObject({ index: 0, path: "d/sub/a.txt" });
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
	});

	describe("sending files", () => {
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
					index: 0,
					path: "d/large.txt",
					size: 13,
					cid: `bafy-${encodeURIComponent("d/large.txt")}`,
				},
				{
					index: 1,
					path: "d/s.txt",
					size: 1,
					cid: `bafy-${encodeURIComponent("d/s.txt")}`,
				},
				{
					index: 2,
					path: "d/m.txt",
					size: 2,
					cid: `bafy-${encodeURIComponent("d/m.txt")}`,
				},
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
			expect(
				error.uploaded.map((f: { path: string }) => f.path).sort(),
			).toEqual(["d/b.txt", "d/c.txt"]);
			expect(created.map((c) => c.path).slice(0, 2)).toEqual([
				"d/a.txt",
				"d/b.txt",
			]);
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

		it("has at most 8 files per slot under way, sending or waiting for registration", async () => {
			// Each file is registered after many checks, so the others pile up behind the cap
			const polls = new Map<string, number>();
			let waiting = 0;
			let peak = 0;
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				if (init.method === "PUT") {
					return new Response(
						JSON.stringify({
							data: {
								id: "f",
								name: "d",
								cid: "bafyfolder",
								number_of_files: 40,
							},
						}),
						{ status: 200 },
					);
				}
				if (init.method === "POST") {
					const headers = init.headers as Record<string, string>;
					const path = decodeMetadata(headers["Upload-Metadata"]).filename;
					waiting++;
					peak = Math.max(peak, waiting);
					return new Response(null, {
						status: 201,
						headers: {
							Location: `${url}/${encodeURIComponent(path)}`,
							"Upload-Offset": "1",
							"Upload-Cid": `bafy-${path}`,
							"Upload-Status": "processing",
						},
					});
				}
				const n = (polls.get(url) ?? 0) + 1;
				polls.set(url, n);
				const ready = n >= 200;
				if (ready) waiting--;
				return new Response(null, {
					status: 200,
					headers: {
						"Upload-Offset": "1",
						"Upload-Status": ready ? "ready" : "processing",
					},
				});
			}) as unknown as typeof fetch;

			await uploadFolder(
				config,
				Array.from({ length: 40 }, (_, i) => ({
					path: `d/${i}.txt`,
					file: file("x"),
				})),
				"public",
				{ concurrency: 2 },
			);

			expect(peak).toBe(16);
		});

		it("checks the first file's registration every second, the others less often", async () => {
			const delays: number[] = [];
			setTimeoutSpy.mockImplementation(((callback: () => void, ms: number) => {
				delays.push(ms);
				callback();
				return 0;
			}) as unknown as typeof setTimeout);
			const polls = new Map<string, number>();
			const marks: string[] = [];
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				if (init.method === "PUT") {
					return new Response(
						JSON.stringify({
							data: {
								id: "f",
								name: "d",
								cid: "bafyfolder",
								number_of_files: 2,
							},
						}),
						{ status: 200 },
					);
				}
				if (init.method === "POST") {
					const headers = init.headers as Record<string, string>;
					const path = decodeMetadata(headers["Upload-Metadata"]).filename;
					marks.push(`${delays.length} POST ${path}`);
					return new Response(null, {
						status: 201,
						headers: {
							Location: `${url}/${encodeURIComponent(path)}`,
							"Upload-Offset": "1",
							"Upload-Cid": `bafy-${path}`,
							"Upload-Status": "processing",
						},
					});
				}
				const n = (polls.get(url) ?? 0) + 1;
				polls.set(url, n);
				return new Response(null, {
					status: 200,
					headers: {
						"Upload-Offset": "1",
						"Upload-Status": n >= 6 ? "ready" : "processing",
					},
				});
			}) as unknown as typeof fetch;

			await uploadFolder(
				config,
				[
					{ path: "d/first.txt", file: file("a") },
					{ path: "d/second.txt", file: file("b") },
				],
				"public",
			);

			expect(marks).toEqual(["0 POST d/first.txt", "6 POST d/second.txt"]);
			expect(delays.slice(0, 6)).toEqual(Array(6).fill(1000));
			expect(delays.slice(6)).toEqual([1000, 2000, 4000, 8000, 10000, 10000]);
		});

		it("reports a file sent once its bytes are stored, before its registration ends", async () => {
			let heads = 0;
			const timeline: string[] = [];
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				if (init.method === "PUT") {
					return new Response(
						JSON.stringify({
							data: {
								id: "f",
								name: "d",
								cid: "bafyfolder",
								number_of_files: 1,
							},
						}),
						{ status: 200 },
					);
				}
				if (init.method === "POST") {
					timeline.push("POST");
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
				timeline.push(`HEAD ${heads}`);
				return new Response(null, {
					status: 200,
					headers: {
						"Upload-Offset": "1",
						"Upload-Status": heads < 3 ? "processing" : "ready",
					},
				});
			}) as unknown as typeof fetch;

			await uploadFolder(
				config,
				[{ path: "d/a.txt", file: file("a") }],
				"public",
				{
					onProgress: (e) => timeline.push(`${e.type} ${e.index} ${e.attempt}`),
				},
			);

			expect(timeline).toEqual([
				"start 0 1",
				"POST",
				"sent 0 1",
				"HEAD 1",
				"HEAD 2",
				"HEAD 3",
				"complete 0 1",
			]);
		});

		it("ignores what onProgress throws", async () => {
			const { created } = server((creation) =>
				creation.path === "d/bad.txt"
					? refused(400, "invalid name")
					: undefined,
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
	});

	describe("options", () => {
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

		it("refuses a folder id that is not a UUID", async () => {
			const { created } = server();
			await expect(
				uploadFolder(
					config,
					[{ path: "d/a.txt", file: file("a") }],
					"private",
					{
						folderId: "../x",
					},
				),
			).rejects.toBeInstanceOf(ValidationError);
			expect(created).toHaveLength(0);
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
				return registeredAt(url, init);
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
					([, init]) =>
						init.method === "POST" && pathOf(init) === "d/never.txt",
				),
			).toHaveLength(4);
			expect(peak).toBeLessThanOrEqual(4);
		});

		it("asks for the CID version given, on every file of the folder", async () => {
			const urls: string[] = [];
			const versions: string[] = [];
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				if (init.method === "PUT") return synced(2);
				urls.push(url);
				versions.push(
					decodeMetadata(
						(init.headers as Record<string, string>)["Upload-Metadata"],
					).cid_version,
				);
				return registeredAt(url, init);
			}) as unknown as typeof fetch;

			await new PublicUpload(config)
				.folder([
					{ path: "d/a.txt", file: file("a") },
					{ path: "d/b.txt", file: file("bb") },
				])
				.cidVersion("v0");

			expect(versions).toEqual(["v0", "v0"]);
			for (const url of urls) {
				expect(
					new URL(url).searchParams.get("X-Upload-Option-Cid-Version"),
				).toBe("v0");
			}
		});

		it("lets .keyvalues() win over the keyvalues given in the options", async () => {
			const sent: Record<string, string>[] = [];
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				if (init.method === "PUT") return synced(1);
				sent.push(
					decodeMetadata(
						(init.headers as Record<string, string>)["Upload-Metadata"],
					),
				);
				return registeredAt(url, init);
			}) as unknown as typeof fetch;

			await new PublicUpload(config)
				.folder([{ path: "d/a.txt", file: file("a") }], {
					metadata: { name: "kept", keyvalues: { from: "options" } },
				})
				.keyvalues({ from: "builder" });

			expect(sent[0].filename).toBe("kept/a.txt");
			expect(JSON.parse(sent[0].keyvalues)).toEqual({ from: "builder" });
		});
	});

	describe("file sizes", () => {
		it("refuses an inline file whose stream holds more bytes than its size", async () => {
			const posts: number[] = [];
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				if (init.method === "PUT") return synced(1);
				posts.push(1);
				return registeredAt(url, init);
			}) as unknown as typeof fetch;

			// A file on disk read in pieces: 2 MiB of bytes, 1 MiB reported (fs.openAsBlob past
			// 4 GiB reports its size modulo 2^32)
			const liar = NodeLikeFile.of({
				length: 2 * 1024 * 1024,
				reported: 1024 * 1024,
				disk: true,
			});
			const error = await uploadFolder(
				config,
				[{ path: "d/big.bin", file: liar }],
				"public",
			).catch((e) => e);

			expect(error).toBeInstanceOf(ValidationError);
			expect(error.message).toContain("larger than its reported size");
			expect(posts).toHaveLength(0);
		});

		it("refuses a file that reports no bytes but holds some", async () => {
			const posts: number[] = [];
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				if (init.method === "PUT") return synced(1);
				posts.push(1);
				return registeredAt(url, init);
			}) as unknown as typeof fetch;

			const liar = NodeLikeFile.of({ length: 10, reported: 0, disk: true });
			const error = await uploadFolder(
				config,
				[{ path: "d/empty.bin", file: liar }],
				"public",
			).catch((e) => e);

			expect(error).toBeInstanceOf(ValidationError);
			expect(posts).toHaveLength(0);
		});

		it("still uploads a really empty file", async () => {
			global.fetch = jest.fn(async (url: string, init: RequestInit) =>
				init.method === "PUT" ? synced(1) : registeredAt(url, init),
			) as unknown as typeof fetch;

			const result = await uploadFolder(
				config,
				[{ path: "d/empty.txt", file: file("") }],
				"public",
			);

			expect(result.files[0]).toMatchObject({
				size: 0,
				cid: "bafy-d/empty.txt",
			});
		});
	});

	describe("retries", () => {
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
				"sent 3",
				"complete 3",
			]);
			expect(forB[1].error?.message).toBe(
				"Could not start the upload (HTTP 503): Upload service at write capacity",
			);
			expect(events.at(-1)).toMatchObject({
				completed: 2,
				failed: 0,
				total: 2,
			});
		});

		it("waits as long as a 429 asks before sending a file again", async () => {
			let creations = 0;
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				if (init.method === "PUT") return synced(2);
				creations++;
				if (creations === 2) {
					return new Response(
						JSON.stringify({ error: { message: "slow down" } }),
						{
							status: 429,
							headers: { "Retry-After": "20" },
						},
					);
				}
				return registeredAt(url, init);
			}) as unknown as typeof fetch;
			const events: FolderUploadEvent[] = [];

			await uploadFolder(
				config,
				[
					{ path: "d/a.txt", file: file("a") },
					{ path: "d/b.txt", file: file("bb") },
				],
				"public",
				{ onProgress: (e) => events.push(e) },
			);

			const retry = events.find((e) => e.type === "retry");
			expect(retry?.delayMs).toBe(20000);
			expect(retry?.error?.message).toBe(
				"Could not start the upload (HTTP 429): slow down",
			);
			expect(delays).toContain(20000);
		});

		it("waits as long as a refused chunk asks, and says why it failed without raw JSON", async () => {
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
					return new Response(
						JSON.stringify({ error: { message: "write capacity" } }),
						{ status: 503, headers: { "Retry-After": "30" } },
					);
				}
				return new Response(null, {
					status: 200,
					headers: { "Upload-Offset": "0" },
				});
			}) as unknown as typeof fetch;

			const error = await uploadFolder(
				config,
				[{ path: "d/big.bin", file: big() }],
				"public",
				{ retries: 0 },
			).catch((e) => e);

			expect(patches).toBe(6);
			expect(delays.filter((ms) => ms === 30000)).toHaveLength(5);
			expect(error.message).toBe(
				"Could not send the file (HTTP 503) after 5 retries: write capacity",
			);
		});

		it("says the upload server could not be reached when a request gets no answer", async () => {
			global.fetch = jest.fn(async () => {
				throw new TypeError("Failed to fetch");
			}) as unknown as typeof fetch;

			await expect(
				uploadFolder(config, [{ path: "d/a.txt", file: file("a") }], "public", {
					retries: 0,
				}),
			).rejects.toThrow("Could not reach the upload server: Failed to fetch");
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
							file: new File(
								[new Uint8Array(50 * 1024 * 1024 + 2)],
								"large.bin",
							),
						},
					],
					"public",
					{ retries: 0 },
				),
			).rejects.toThrow("too large");
			expect(patches).toBe(1);
		});

		it("fails a file at once when the server refuses to look it up", async () => {
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
				return new Response(null, { status: 400 });
			}) as unknown as typeof fetch;

			const error = await uploadFolder(
				config,
				[{ path: "d/a.txt", file: file("a") }],
				"public",
			).catch((e) => e);

			expect(error.message).toBe(
				"The server refused to look up the upload (HTTP 400)",
			);
			expect(error.statusCode).toBe(400);
			expect(heads).toBe(1);
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

		describe("in a browser that goes offline", () => {
			const online = new EventTarget();
			const scope = globalThis as unknown as Record<string, unknown>;
			const navigatorDescriptor = Object.getOwnPropertyDescriptor(
				globalThis,
				"navigator",
			);
			let onLine = true;
			beforeEach(() => {
				onLine = true;
				Object.defineProperty(globalThis, "navigator", {
					value: {
						get onLine() {
							return onLine;
						},
					},
					configurable: true,
				});
				scope.addEventListener = online.addEventListener.bind(online);
				scope.removeEventListener = online.removeEventListener.bind(online);
			});
			afterEach(() => {
				if (navigatorDescriptor) {
					Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
				} else {
					delete scope.navigator;
				}
				delete scope.addEventListener;
				delete scope.removeEventListener;
			});

			it("waits until it is back online, without spending the file's retries", async () => {
				let creations = 0;
				global.fetch = jest.fn(async (url: string, init: RequestInit) => {
					if (init.method === "PUT") return synced(1);
					creations++;
					if (creations <= 3) {
						onLine = false;
						// Back online once the upload waits for it
						setImmediate(() => {
							onLine = true;
							online.dispatchEvent(new Event("online"));
						});
						throw new TypeError("Failed to fetch");
					}
					return registeredAt(url, init);
				}) as unknown as typeof fetch;

				const events: FolderUploadEvent[] = [];
				const result = await uploadFolder(
					config,
					[{ path: "d/a.txt", file: file("a") }],
					"public",
					{ retries: 0, onProgress: (e) => events.push(e) },
				);

				expect(result.cid).toBe("bafyfolder");
				expect(creations).toBe(4);
				// Each retry says it waits for the browser to be back online, not for delayMs
				const retries = events.filter((e) => e.type === "retry");
				expect(retries).toHaveLength(3);
				for (const retry of retries) {
					expect(retry).toMatchObject({ delayMs: 0, waitingForOnline: true });
				}
			});

			it("resumes a chunk once back online, without spending its retries", async () => {
				const patches: string[] = [];
				global.fetch = jest.fn(async (url: string, init: RequestInit) => {
					const headers = init.headers as Record<string, string>;
					if (init.method === "PUT") return synced(1);
					if (init.method === "POST") {
						return new Response(null, {
							status: 201,
							headers: { Location: `${url}/upload` },
						});
					}
					if (init.method === "HEAD") {
						return new Response(null, {
							status: 200,
							headers: { "Upload-Offset": "0" },
						});
					}
					patches.push(headers["Upload-Offset"]);
					if (patches.length <= 7) {
						onLine = false;
						setImmediate(() => {
							onLine = true;
							online.dispatchEvent(new Event("online"));
						});
						throw new TypeError("Failed to fetch");
					}
					return new Response(null, {
						status: 204,
						headers: {
							"Upload-Offset":
								headers["Upload-Offset"] === "0" ? "52428801" : "52428802",
							"Upload-Cid": "bafybig",
						},
					});
				}) as unknown as typeof fetch;

				const result = await uploadFolder(
					config,
					[{ path: "d/big.bin", file: big() }],
					"public",
					{ retries: 0 },
				);

				expect(result.files[0].cid).toBe("bafybig");
				// More failures than the 5 chunk retries, none of them counted
				expect(patches).toHaveLength(9);
			});
		});
	});

	describe("resuming a file", () => {
		it("continues the upload its last attempt left unfinished", async () => {
			const chunk = 50 * 1024 * 1024 + 1;
			const size = chunk + 10;
			let stored = 0;
			let lost = 0;
			const calls: string[] = [];
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				const headers = init.headers as Record<string, string>;
				const offset = headers["Upload-Offset"];
				calls.push(`${init.method}${offset ? ` ${offset}` : ""}`);
				if (init.method === "PUT") {
					return new Response(
						JSON.stringify({
							data: {
								id: "f",
								name: "d",
								cid: "bafyfolder",
								number_of_files: 1,
							},
						}),
						{ status: 200 },
					);
				}
				if (init.method === "POST") {
					return new Response(null, {
						status: 201,
						headers: { Location: `${url}/upload` },
					});
				}
				if (init.method === "HEAD") {
					return new Response(null, {
						status: 200,
						headers: { "Upload-Offset": `${stored}` },
					});
				}
				// The second chunk is lost more times than the chunk retries allow
				if (offset === `${chunk}` && lost < 6) {
					lost++;
					throw new TypeError("fetch failed");
				}
				stored = offset === "0" ? chunk : size;
				return new Response(null, {
					status: 204,
					headers: {
						"Upload-Offset": `${stored}`,
						...(stored === size ? { "Upload-Cid": "bafybig" } : {}),
					},
				});
			}) as unknown as typeof fetch;
			const events: string[] = [];

			const result = await uploadFolder(
				config,
				[
					{
						path: "d/big.bin",
						file: new File([new Uint8Array(size)], "big.bin"),
					},
				],
				"public",
				{ onProgress: (e) => events.push(`${e.type} ${e.attempt}`) },
			);

			expect(result.files[0].cid).toBe("bafybig");
			expect(events).toEqual([
				"start 1",
				"retry 1",
				"start 2",
				"sent 2",
				"complete 2",
			]);
			// One upload, continued from the stored chunk
			expect(calls.filter((c) => c === "POST")).toHaveLength(1);
			expect(calls.filter((c) => c === "PATCH 0")).toHaveLength(1);
			expect(calls.slice(-3)).toEqual(["HEAD", `PATCH ${chunk}`, "PUT"]);
		});

		it("keeps the unfinished upload when the server cannot say where it stands", async () => {
			const chunk = 50 * 1024 * 1024 + 1;
			const size = chunk + 10;
			let stored = 0;
			let lost = 0;
			let heads = 0;
			const calls: string[] = [];
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				const headers = init.headers as Record<string, string>;
				const offset = headers["Upload-Offset"];
				calls.push(`${init.method}${offset ? ` ${offset}` : ""}`);
				if (init.method === "PUT") {
					return new Response(
						JSON.stringify({
							data: {
								id: "f",
								name: "d",
								cid: "bafyfolder",
								number_of_files: 1,
							},
						}),
						{ status: 200 },
					);
				}
				if (init.method === "POST") {
					return new Response(null, {
						status: 201,
						headers: { Location: `${url}/upload` },
					});
				}
				if (init.method === "HEAD") {
					heads++;
					// No answer to the chunk retries' HEADs nor to the first one of the next attempt
					if (heads <= 6) throw new TypeError("fetch failed");
					return new Response(null, {
						status: 200,
						headers: { "Upload-Offset": `${stored}` },
					});
				}
				if (offset === `${chunk}` && lost < 6) {
					lost++;
					throw new TypeError("fetch failed");
				}
				stored = offset === "0" ? chunk : size;
				return new Response(null, {
					status: 204,
					headers: {
						"Upload-Offset": `${stored}`,
						...(stored === size ? { "Upload-Cid": "bafybig" } : {}),
					},
				});
			}) as unknown as typeof fetch;

			const result = await uploadFolder(
				config,
				[
					{
						path: "d/big.bin",
						file: new File([new Uint8Array(size)], "big.bin"),
					},
				],
				"public",
			);

			expect(result.files[0].cid).toBe("bafybig");
			expect(calls.filter((c) => c === "POST")).toHaveLength(1);
			expect(calls.slice(-4)).toEqual([
				"HEAD",
				"HEAD",
				`PATCH ${chunk}`,
				"PUT",
			]);
		});

		it("continues the upload when checking it after a failed CHUNK is refused the JWT", async () => {
			const size = 2 * CHUNK + 10;
			let stored = 0;
			let failedOnce = false;
			const calls: string[] = [];
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				const headers = init.headers as Record<string, string>;
				const old = headers.Authorization === "Bearer t1";
				calls.push(
					`${init.method}${headers["Upload-Offset"] ? ` ${headers["Upload-Offset"]}` : ""}`,
				);
				if (init.method === "PUT") return synced(1);
				if (init.method === "POST") {
					return new Response(null, {
						status: 201,
						headers: { Location: `${url}/upload` },
					});
				}
				if (init.method === "HEAD") {
					// The JWT expired while the CHUNK failed
					if (old) return new Response(null, { status: 401 });
					return new Response(null, {
						status: 200,
						headers: { "Upload-Offset": `${stored}` },
					});
				}
				if (headers["Upload-Offset"] === `${CHUNK}` && !failedOnce) {
					failedOnce = true;
					return new Response("busy", { status: 503 });
				}
				stored = Math.min(size, Number(headers["Upload-Offset"]) + CHUNK);
				return new Response(null, {
					status: 204,
					headers: {
						"Upload-Offset": `${stored}`,
						...(stored === size ? { "Upload-Cid": "bafybig" } : {}),
					},
				});
			}) as unknown as typeof fetch;

			const result = await uploadFolder(
				{ ...config, pinataJwt: "t1" },
				[
					{
						path: "d/big.bin",
						file: new File([new Uint8Array(size)], "big.bin"),
					},
				],
				"public",
				{ refreshJwt: () => "t2" },
			);

			expect(result.files[0].cid).toBe("bafybig");
			expect(calls.filter((c) => c === "POST")).toHaveLength(1);
			expect(calls.filter((c) => c === "PATCH 0")).toHaveLength(1);
		});
	});

	describe("failed files", () => {
		it("goes on without a file that fails for good, then reports which files failed", async () => {
			const { fetchMock } = server((creation) =>
				creation.path === "d/bad.txt"
					? refused(400, "invalid name")
					: undefined,
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
			expect(
				error.uploaded.map((f: { path: string }) => f.path).sort(),
			).toEqual(["d/a.txt", "d/c.txt"]);
			expect(error.failed).toHaveLength(1);
			expect(error.failed[0].path).toBe("d/bad.txt");
			expect(error.failed[0].error.message).toBe(
				"Could not start the upload (HTTP 400): invalid name",
			);
			expect(error.failed[0].index).toBe(1);
			// Not retried; the folder is synced once, without the failed file
			expect(
				fetchMock.mock.calls.filter(
					(call) => (call[1] as RequestInit).method === "PUT",
				),
			).toHaveLength(1);
			expect(error.folder).toEqual({
				id: error.folderId,
				name: "d",
				cid: "bafyfolder",
			});
		});

		it("keeps why files failed when the partly uploaded folder cannot be synced", async () => {
			const { fetchMock } = server((creation) =>
				creation.path === "d/bad.txt"
					? refused(400, "invalid name")
					: undefined,
			);
			const respond = fetchMock.getMockImplementation() as (
				url: string,
				init: RequestInit,
			) => Promise<Response>;
			fetchMock.mockImplementation(async (url: string, init: RequestInit) =>
				init.method === "PUT"
					? new Response("down", { status: 503 })
					: respond(url, init),
			);

			const error = await uploadFolder(
				config,
				[
					{ path: "d/a.txt", file: file("a") },
					{ path: "d/bad.txt", file: file("bad") },
				],
				"public",
				{ retries: 1 },
			).catch((e) => e);

			expect(error).toBeInstanceOf(FolderUploadError);
			expect(error.message).toContain("d/bad.txt: Could not start the upload");
			expect(error.folder).toBeUndefined();
		});

		it("uploads into a given folder, so failed files can be sent again into it", async () => {
			const { created } = server();
			const folderId = "01a1d1d0-c031-7430-8e84-34db001732c0";

			await uploadFolder(
				config,
				[
					{ path: "d/a.txt", file: file("a") },
					{ path: "d/sub/b.txt", file: file("bb") },
				],
				"private",
				{ folderId },
			);

			expect(created.map((c) => c.folderId)).toEqual([folderId, folderId]);
		});

		it("sends failed files again by their full paths, under the folder's name", async () => {
			const created: string[] = [];
			let refuseB = true;
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				if (init.method === "PUT") return synced(created.length);
				const path = pathOf(init);
				if (path.endsWith("docs/b.txt") && refuseB) {
					return refused(400, "invalid name");
				}
				created.push(path);
				return registeredAt(url, init);
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
			const result = await uploadFolder(
				config,
				error.failed.map((f: { index: number; path: string }) => ({
					path: f.path,
					file: files[f.index].file,
				})),
				"public",
				{ folderId: error.folderId },
			);
			expect(result.number_of_files).toBe(2);
			expect(created).toEqual([
				"folder_from_sdk/a.txt",
				"folder_from_sdk/docs/b.txt",
			]);
		});
	});

	describe("content already uploaded", () => {
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

		it("answers with the earlier folder when syncing finds this one merged into it", async () => {
			const encodeValue = (v: string) => Buffer.from(v).toString("base64");
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				if (init.method === "PUT") {
					return new Response(
						JSON.stringify({ error: { message: "bucket not found" } }),
						{ status: 404 },
					);
				}
				// The one file is registered as the earlier one-file folder of the same content
				return new Response(null, {
					status: 201,
					headers: {
						Location: `${url}/d/only.txt`,
						"Upload-Offset": "1",
						"Upload-Cid": "bafkonly",
						"Upload-Metadata": `filename ${encodeValue("d")},file_id ${encodeValue("earlier-folder")},cid ${encodeValue("bafyearlier")}`,
					},
				});
			}) as unknown as typeof fetch;

			const result = await uploadFolder(
				config,
				[{ path: "d/only.txt", file: file("a") }],
				"public",
			);

			expect(result).toMatchObject({
				id: "earlier-folder",
				name: "d",
				cid: "bafyearlier",
				is_duplicate: true,
				number_of_files: 1,
			});
			expect(result.files).toEqual([
				{ index: 0, path: "d/only.txt", size: 1, cid: "bafkonly" },
			]);
		});

		it("reports the earlier folder a partly uploaded folder turned out to duplicate", async () => {
			const { fetchMock } = server((creation) =>
				creation.path === "d/bad.txt"
					? refused(400, "invalid name")
					: undefined,
			);
			const respond = fetchMock.getMockImplementation() as (
				url: string,
				init: RequestInit,
			) => Promise<Response>;
			fetchMock.mockImplementation(async (url: string, init: RequestInit) =>
				init.method === "PUT"
					? new Response(
							JSON.stringify({
								data: {
									id: "earlier-folder",
									name: "first",
									cid: "bafyearlier",
									size: 1,
									number_of_files: 1,
									is_duplicate: true,
								},
							}),
							{ status: 200 },
						)
					: respond(url, init),
			);

			const error = await uploadFolder(
				config,
				[
					{ path: "d/a.txt", file: file("a") },
					{ path: "d/bad.txt", file: file("bad") },
				],
				"public",
			).catch((e) => e);

			expect(error).toBeInstanceOf(FolderUploadError);
			expect(error.folder).toEqual({
				id: "earlier-folder",
				name: "first",
				cid: "bafyearlier",
				is_duplicate: true,
			});
		});

		it("rejects a folder of several files whose sync answers 404, even if one file matched an earlier folder", async () => {
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				if (init.method === "PUT") {
					return refused(404, "bucket not found");
				}
				const path = pathOf(init);
				const response = registeredAt(url, init);
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

		it("rejects when the synced folder holds fewer files than were uploaded", async () => {
			global.fetch = jest.fn(async (url: string, init: RequestInit) =>
				init.method === "PUT" ? synced(1) : registeredAt(url, init),
			) as unknown as typeof fetch;

			await expect(
				uploadFolder(
					config,
					[
						{ path: "d/a.txt", file: file("a") },
						{ path: "d/b.txt", file: file("bb") },
					],
					"public",
				),
			).rejects.toThrow("holds 1 of the 2 uploaded files");
		});
	});

	describe("JWTs", () => {
		it("stops sending files after an authentication failure, which fail without being sent", async () => {
			const { created } = server((creation) =>
				creation.path === "d/a2.txt"
					? refused(401, "Not Authorized")
					: undefined,
			);
			const events: FolderUploadEvent[] = [];

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
				{ concurrency: 1, onProgress: (e) => events.push(e) },
			).catch((e) => e);

			expect(error).toBeInstanceOf(FolderUploadError);
			expect(error.failed).toHaveLength(6);
			expect(created.map((c) => c.path)).toEqual(["d/a1.txt", "d/a2.txt"]);
			// A file never sent reports attempt 0, and no start or retry
			for (let i = 0; i < 5; i++) {
				expect(
					events
						.filter((e) => e.path === `d/later${i}.txt`)
						.map((e) => `${e.type} ${e.attempt}`),
				).toEqual(["error 0"]);
			}
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

		it("checks a file's registration with a JWT replaced while it was being sent", async () => {
			const live: PinataConfig = { ...config, pinataJwt: "first-jwt" };
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				const auth = (init.headers as Record<string, string>).Authorization;
				if (init.method === "POST") {
					// The token expires: the app sets a fresh one
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

		it("never sends a file into the upload of another file refused the JWT", async () => {
			const live: PinataConfig = { ...config, pinataJwt: "J0" };
			const requests: string[] = [];
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				const headers = init.headers as Record<string, string>;
				if (init.method === "PUT") return synced(2);
				if (init.method === "POST") {
					const path = pathOf(init);
					requests.push(`POST ${path} ${headers.Authorization}`);
					if (path === "d/0.txt") return registeredAt(url, init);
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
				const size =
					Number(headers["Upload-Offset"]) + (init.body as Blob).size;
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

		describe("when the server refuses the JWT", () => {
			const live = () => ({ ...config, pinataJwt: "old-jwt" });
			// 401 for every request with the old JWT
			const authServer = () => {
				const auths: string[] = [];
				global.fetch = jest.fn(async (url: string, init: RequestInit) => {
					const headers = init.headers as Record<string, string>;
					auths.push(`${init.method} ${headers.Authorization}`);
					if (headers.Authorization === "Bearer old-jwt") {
						return refused(401, "Invalid/expired token");
					}
					if (init.method === "PUT") return synced(3);
					return registeredAt(url, init);
				}) as unknown as typeof fetch;
				return auths;
			};

			it("asks refreshJwt once for a new one and sends the refused files again", async () => {
				const auths = authServer();
				const refreshJwt = jest.fn(async () => "new-jwt");
				const entries = Array.from({ length: 3 }, (_, i) => ({
					path: `d/${i}.txt`,
					file: file(`${i}`),
				}));

				const result = await uploadFolder(live(), entries, "public", {
					refreshJwt,
					concurrency: 3,
				});

				expect(refreshJwt).toHaveBeenCalledTimes(1);
				expect(result.files.map((f) => f.cid)).toEqual([
					"bafy-d/0.txt",
					"bafy-d/1.txt",
					"bafy-d/2.txt",
				]);
				expect(auths.at(-1)).toBe("PUT Bearer new-jwt");
			});

			it("sends a refused file again when the JWT was replaced meanwhile", async () => {
				authServer();
				const settings = live();
				const fetchMock = global.fetch as jest.Mock;
				const respond = fetchMock.getMockImplementation() as (
					url: string,
					init: RequestInit,
				) => Promise<Response>;
				// setNewJwt lands while the refused request is under way
				fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
					const response = await respond(url, init);
					if (response.status === 401) settings.pinataJwt = "new-jwt";
					return response;
				});

				const result = await uploadFolder(
					settings,
					[{ path: "d/a.txt", file: file("a") }],
					"public",
					{ retries: 0 },
				);

				expect(result.files[0].cid).toBe("bafy-d/a.txt");
			});

			it("fails the files when no new JWT comes", async () => {
				authServer();

				const error = await uploadFolder(
					live(),
					[
						{ path: "d/a.txt", file: file("a") },
						{ path: "d/b.txt", file: file("bb") },
					],
					"public",
					{ refreshJwt: async () => undefined },
				).catch((e) => e);

				expect(error.statusCode).toBe(401);
				expect(error.message).toBe(
					"Could not start the upload (HTTP 401): Invalid/expired token",
				);
			});

			it("checks a stored file's registration again with the new JWT, without sending it again", async () => {
				const calls: string[] = [];
				global.fetch = jest.fn(async (url: string, init: RequestInit) => {
					const headers = init.headers as Record<string, string>;
					calls.push(`${init.method} ${headers.Authorization}`);
					if (init.method === "PUT") return synced(1);
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
					if (headers.Authorization === "Bearer old-jwt") {
						return new Response(null, { status: 401 });
					}
					return new Response(null, {
						status: 200,
						headers: { "Upload-Offset": "1", "Upload-Status": "ready" },
					});
				}) as unknown as typeof fetch;

				const result = await uploadFolder(
					live(),
					[{ path: "d/a.txt", file: file("a") }],
					"public",
					{ refreshJwt: () => "new-jwt" },
				);

				expect(result.files[0].cid).toBe("bafyfile");
				expect(calls).toEqual([
					"POST Bearer old-jwt",
					"HEAD Bearer old-jwt",
					"HEAD Bearer new-jwt",
					"PUT Bearer new-jwt",
				]);
			});
		});

		it("renews a JWT the final sync is refused, without spending its retries", async () => {
			const auth = expiring(1);
			const calls: string[] = [];
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				const headers = init.headers as Record<string, string>;
				calls.push(`${init.method} ${headers.Authorization}`);
				if (!auth.accepts(headers))
					return refused(401, "Invalid/expired token");
				return init.method === "PUT" ? synced(1) : registeredAt(url, init);
			}) as unknown as typeof fetch;

			const result = await uploadFolder(
				auth.config,
				[{ path: "d/a.txt", file: file("a") }],
				"public",
				{ refreshJwt: auth.refreshJwt, retries: 0 },
			);

			expect(result.cid).toBe("bafyfolder");
			expect(calls).toEqual([
				"POST Bearer t1",
				"PUT Bearer t1",
				"PUT Bearer t2",
			]);
			expect(auth.refreshJwt).toHaveBeenCalledTimes(1);
		});

		it("renews a JWT the sync of a partly uploaded folder is refused", async () => {
			const auth = expiring(1);
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				const headers = init.headers as Record<string, string>;
				const path =
					init.method === "POST"
						? decodeMetadata(headers["Upload-Metadata"]).filename
						: "";
				if (path === "d/bad.txt") return refused(400, "invalid name");
				if (!auth.accepts(headers))
					return refused(401, "Invalid/expired token");
				return init.method === "PUT" ? synced(1) : registeredAt(url, init);
			}) as unknown as typeof fetch;

			const error = await uploadFolder(
				auth.config,
				[
					{ path: "d/a.txt", file: file("a") },
					{ path: "d/bad.txt", file: file("bb") },
				],
				"public",
				{ refreshJwt: auth.refreshJwt },
			).catch((e) => e);

			expect(error).toBeInstanceOf(FolderUploadError);
			expect(error.folder?.cid).toBe("bafyfolder");
		});

		it("keeps renewing the JWT of a file that outlives several of them, as long as it progresses", async () => {
			// Four chunks; each JWT is accepted for two requests
			const auth = expiring(2);
			let stored = 0;
			const size = 3 * CHUNK + 10;
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				const headers = init.headers as Record<string, string>;
				if (!auth.accepts(headers))
					return refused(401, "Invalid/expired token");
				if (init.method === "PUT") return synced(1);
				if (init.method === "POST") {
					return new Response(null, {
						status: 201,
						headers: { Location: `${url}/upload` },
					});
				}
				if (init.method === "HEAD") {
					return new Response(null, {
						status: 200,
						headers: { "Upload-Offset": `${stored}` },
					});
				}
				stored = Math.min(size, Number(headers["Upload-Offset"]) + CHUNK);
				return new Response(null, {
					status: 204,
					headers: {
						"Upload-Offset": `${stored}`,
						...(stored === size ? { "Upload-Cid": "bafybig" } : {}),
					},
				});
			}) as unknown as typeof fetch;

			const result = await uploadFolder(
				auth.config,
				[
					{
						path: "d/big.bin",
						file: new File([new Uint8Array(size)], "big.bin"),
					},
				],
				"public",
				{ refreshJwt: auth.refreshJwt },
			);

			expect(result.files[0].cid).toBe("bafybig");
			expect(auth.refreshJwt.mock.calls.length).toBeGreaterThan(2);
		});

		it("asks for a new JWT when the one a file was sent with is refused, even if it changed while the file waited", async () => {
			// t1 is refused after one use, t2 at once, t3 never
			const used = new Map<string, number>();
			const limits: Record<string, number> = { t1: 1, t2: 0 };
			const posts: string[] = [];
			let issued = 1;
			const refreshJwt = jest.fn(async () => `t${++issued}`);
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				const headers = init.headers as Record<string, string>;
				const jwt = headers.Authorization.replace("Bearer ", "");
				const n = (used.get(jwt) ?? 0) + 1;
				used.set(jwt, n);
				if (init.method === "POST") posts.push(jwt);
				if (n > (limits[jwt] ?? Number.POSITIVE_INFINITY)) {
					return refused(401, "Invalid/expired token");
				}
				return init.method === "PUT" ? synced(3) : registeredAt(url, init);
			}) as unknown as typeof fetch;

			await uploadFolder(
				{ ...config, pinataJwt: "t1" },
				[
					{ path: "d/a.txt", file: file("a") },
					{ path: "d/b.txt", file: file("bb") },
					{ path: "d/c.txt", file: file("cc") },
				],
				"public",
				{ refreshJwt, concurrency: 1 },
			);

			// t2, refused, is used once and replaced at once
			expect(posts.filter((jwt) => jwt === "t2")).toHaveLength(1);
			expect(refreshJwt).toHaveBeenCalledTimes(2);
		});
	});

	describe("cancelling", () => {
		it("sends nothing when cancelled before it starts", async () => {
			const { created } = server();
			const controller = new AbortController();
			controller.abort();

			const error = await uploadFolder(
				config,
				[{ path: "d/a.txt", file: file("a") }],
				"private",
				{ signal: controller.signal },
			).catch((e) => e);

			expect(error).toBeInstanceOf(FolderUploadError);
			expect(error.failed[0].error.name).toBe("AbortError");
			expect(created).toHaveLength(0);
		});

		it("stops sending files once cancelled, keeping the ones already uploaded", async () => {
			const { created } = server();
			const controller = new AbortController();
			const events: string[] = [];

			const error = await uploadFolder(
				config,
				Array.from({ length: 5 }, (_, i) => ({
					path: `d/${i}.txt`,
					file: file("x".repeat(i + 1)),
				})),
				"private",
				{
					concurrency: 1,
					signal: controller.signal,
					onProgress: (e) => {
						events.push(`${e.type} ${e.path}`);
						// Cancel once the first file is in
						if (e.type === "complete" && e.completed === 1) controller.abort();
					},
				},
			).catch((e) => e);

			expect(error).toBeInstanceOf(FolderUploadError);
			expect(error.folderId).toBe(created[0].folderId);
			expect(error.uploaded.map((f: { path: string }) => f.path)).toEqual([
				"d/0.txt",
			]);
			expect(error.failed.map((f: { error: Error }) => f.error.name)).toEqual([
				"AbortError",
				"AbortError",
				"AbortError",
				"AbortError",
			]);
			expect(created).toHaveLength(1);
			expect(events.filter((e) => e.startsWith("error"))).toHaveLength(4);
		});

		it("stops waiting to send a chunk again once cancelled", async () => {
			// Pauses never end on their own: only the abort ends them
			setTimeoutSpy.mockImplementation(((_: () => void, ms: number) => {
				delays.push(ms);
				return 0;
			}) as unknown as typeof setTimeout);
			const controller = new AbortController();
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				if (init.method === "POST") {
					return new Response(null, {
						status: 201,
						headers: { Location: `${url}/upload` },
					});
				}
				setImmediate(() => controller.abort());
				return new Response("busy", { status: 503 });
			}) as unknown as typeof fetch;

			const error = await uploadFolder(
				config,
				[{ path: "d/big.bin", file: big() }],
				"public",
				{ signal: controller.signal },
			).catch((e) => e);

			expect(error).toBeInstanceOf(FolderUploadError);
			expect(error.failed[0].error.name).toBe("AbortError");
			expect(delays).toEqual([1000]);
		});

		it("stops at once when cancelled while a new JWT is being asked for", async () => {
			const controller = new AbortController();
			global.fetch = jest.fn(async () =>
				refused(401, "Invalid/expired token"),
			) as unknown as typeof fetch;

			const error = await uploadFolder(
				{ ...config, pinataJwt: "t1" },
				[{ path: "d/a.txt", file: file("a") }],
				"public",
				{
					signal: controller.signal,
					// Never settles: the user would have to sign in again
					refreshJwt: () => {
						setImmediate(() => controller.abort());
						return new Promise<string>(() => {});
					},
				},
			).catch((e) => e);

			expect(error).toBeInstanceOf(FolderUploadError);
			expect(error.failed[0].error.name).toBe("AbortError");
		});

		it("stops finishing the folder once cancelled", async () => {
			const { fetchMock } = server();
			const respond = fetchMock.getMockImplementation() as (
				url: string,
				init: RequestInit,
			) => Promise<Response>;
			const controller = new AbortController();
			let syncs = 0;
			fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
				if (init.method !== "PUT") return respond(url, init);
				syncs++;
				controller.abort();
				throw new DOMException("This operation was aborted", "AbortError");
			});

			const error = await uploadFolder(
				config,
				[{ path: "d/a.txt", file: file("a") }],
				"public",
				{ signal: controller.signal },
			).catch((e) => e);

			expect(error.name).toBe("AbortError");
			expect(error.message).toBe("The upload was cancelled");
			expect(syncs).toBe(1);
		});
	});
});
