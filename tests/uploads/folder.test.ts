import { uploadFolder } from "../../src/core/functions";
import type { FolderUploadEvent, PinataConfig } from "../../src";
import { PublicUpload } from "../../src/core/classes/uploads/PublicUpload";
import {
	AuthenticationError,
	FolderUploadError,
	type PinataError,
	ValidationError,
} from "../../src/utils/custom-errors";
import { registrationTimeout } from "../../src/core/functions/uploads/tusStatus";
import { NodeLikeFile } from "./nodeLikeFile";
import { decodeMetadata } from "./uploadMetadata";

const config: PinataConfig = {
	pinataJwt: "test-jwt",
	uploadUrl: "https://uploads.test/v3",
};

// A folder an earlier upload created
const givenFolderId = "01a1d1d0-c031-7430-8e84-34db001732c0";

const file = (content: string, name = "f.txt", relativePath?: string) => {
	const f = new File([content], name, { type: "text/plain" });
	if (relativePath) {
		Object.defineProperty(f, "webkitRelativePath", { value: relativePath });
	}
	return f;
};

const encode = (value: string) => Buffer.from(value, "utf8").toString("base64");

type Handler = (url: string, init: RequestInit) => Promise<Response>;

// Answers every request with `handler`
const mockFetch = (handler: Handler) => {
	const fetchMock = jest.fn(handler);
	global.fetch = fetchMock as unknown as typeof fetch;
	return fetchMock;
};

const headersOf = (init: RequestInit) => init.headers as Record<string, string>;
const metadataOf = (init: RequestInit) =>
	decodeMetadata(headersOf(init)["Upload-Metadata"]);
const pathOf = (init: RequestInit) => metadataOf(init).filename;

const refused = (status: number, message: string) =>
	new Response(JSON.stringify({ error: { code: status, message } }), {
		status,
	});

// The server's refusal of a new upload of a path while it still finishes an earlier one
const finalizing = (headers: Record<string, string> = {}) =>
	new Response(
		"Upload is finalizing; poll HEAD on its Location for the outcome",
		{ status: 409, headers },
	);

// A creation's answer: the upload at `location`, in the state `headers` tell
const createdAt = (location: string, headers: Record<string, string> = {}) =>
	new Response(null, {
		status: 201,
		headers: { Location: location, ...headers },
	});
// A creation that stores the file's one byte, whose registration is under way
const processing = (location: string, cid = "bafyfile") =>
	createdAt(location, {
		"Upload-Offset": "1",
		"Upload-Cid": cid,
		"Upload-Status": "processing",
	});
// A creation that stores every byte and registers the file at once
const registeredAt = (url: string, init: RequestInit) => {
	const path = pathOf(init);
	return createdAt(`${url}/${encodeURIComponent(path)}`, {
		"Upload-Offset": headersOf(init)["Upload-Length"],
		"Upload-Cid": `bafy-${path}`,
	});
};
// A lookup's answer about a stored one-byte file
const registration = (
	status: "processing" | "ready",
	headers: Record<string, string> = {},
) =>
	new Response(null, {
		status: 200,
		headers: { "Upload-Offset": "1", "Upload-Status": status, ...headers },
	});
// A lookup's answer: the upload holds `offset` bytes
const storedUpTo = (offset: number) =>
	new Response(null, {
		status: 200,
		headers: { "Upload-Offset": `${offset}` },
	});
// A chunk's answer: `offset` bytes stored, and the file's CID once all `size` are
const chunkStored = (offset: number, size: number) =>
	new Response(null, {
		status: 204,
		headers: {
			"Upload-Offset": `${offset}`,
			...(offset === size ? { "Upload-Cid": "bafybig" } : {}),
		},
	});
// The folder sync's answer
const syncedAs = (data: Record<string, unknown>) =>
	new Response(JSON.stringify({ data }), { status: 200 });
// A folder "d" holding `files` files; `{}` leaves its size out
const synced = (files: number, { size }: { size?: number } = { size: 1 }) =>
	syncedAs({
		id: "f",
		name: "d",
		cid: "bafyfolder",
		size,
		number_of_files: files,
	});

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
	const respond: Handler = async (url, init) => {
		if (init.method === "PUT") {
			return syncedAs({
				id: url.split("/buckets/")[1].split("/")[0],
				name: registered[0]?.split("/")[0],
				cid: "bafyfolder",
				size: 1,
				number_of_files: registered.length,
				network: "private",
				mime_type: "directory",
				created_at: "2026-11-12T00:00:00.000Z",
			});
		}
		const folderId = url.split("/files/")[1].split("?")[0];
		const path = pathOf(init);
		const creation = { path, folderId };
		created.push(creation);
		events.push(`create ${path}`);
		const response = answer(creation, n++);
		if (response) return response;
		registered.push(path);
		events.push(`registered ${path}`);
		return createdAt(
			`https://uploads.test/v3/files/${folderId}/${encodeURIComponent(path)}`,
			{
				"Upload-Offset": headersOf(init)["Upload-Length"],
				"Upload-Cid": `bafy-${encodeURIComponent(path)}`,
				"Upload-Metadata": `filename ${encode(path)},file_id ${encode(folderId)},cid ${encode(`bafy-${path}`)}`,
			},
		);
	};
	return {
		fetchMock: mockFetch(respond),
		respond,
		created,
		registered,
		events,
	};
};

// The size of a resumable upload's chunk, and a file just over one chunk
const CHUNK = 50 * 1024 * 1024 + 1;
const big = () =>
	new File([new Uint8Array(CHUNK + 1)], "big.bin", {
		type: "application/octet-stream",
	});
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

		it("sends every file into a given folder at once, without waiting for a first one", async () => {
			server();
			const events: string[] = [];

			await uploadFolder(
				config,
				[
					{ path: "d/first.txt", file: file("a") },
					{ path: "d/second.txt", file: file("b") },
				],
				"public",
				{
					folderId: givenFolderId,
					onProgress: (e) => events.push(`${e.type} ${e.path}`),
				},
			);

			// The second file starts while the first is under way, not once it is registered
			expect(events.indexOf("start d/second.txt")).toBeLessThan(
				events.indexOf("complete d/first.txt"),
			);
		});

		it("reports the failed files of a given folder like any partial failure, after trying every file", async () => {
			const { created } = server((creation) =>
				creation.path === "d/a.txt"
					? refused(503, "Service Unavailable")
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
				{ folderId: givenFolderId, retries: 1 },
			).catch((e) => e);

			expect(error).toBeInstanceOf(FolderUploadError);
			expect(error.folderId).toBe(givenFolderId);
			expect(error.folderName).toBe("d");
			expect(error.failed.map((f: { path: string }) => f.path)).toEqual([
				"d/a.txt",
			]);
			expect(error.failed[0].error.statusCode).toBe(503);
			expect(
				error.uploaded.map((f: { path: string }) => f.path).sort(),
			).toEqual(["d/b.txt", "d/c.txt"]);
			expect(created.filter((c) => c.path === "d/a.txt")).toHaveLength(2);
		});

		it("stops sending files into a given folder once 3 in a row fail alike, failing the others unsent", async () => {
			const { created } = server(() =>
				refused(422, "This folder no longer accepts files"),
			);
			const events: FolderUploadEvent[] = [];

			const error = await uploadFolder(
				config,
				Array.from({ length: 30 }, (_, i) => ({
					path: `d/${i}.txt`,
					file: file("x"),
				})),
				"public",
				{ folderId: givenFolderId, onProgress: (e) => events.push(e) },
			).catch((e) => e);

			expect(error).toBeInstanceOf(FolderUploadError);
			expect(error.folderId).toBe(givenFolderId);
			expect(error.folderName).toBe("d");
			expect(error.failed).toHaveLength(30);
			// The 3 that failed, and those still sending when the third did: at most one in each
			// of the 3 other slots (concurrency 4)
			expect(created.length).toBeGreaterThanOrEqual(3);
			expect(created.length).toBeLessThanOrEqual(6);
			for (const failed of error.failed) {
				expect(failed.error.message).toBe(
					"Could not start the upload (HTTP 422): This folder no longer accepts files",
				);
			}
			// A file never sent reports attempt 0, and no start or retry
			const sent = new Set(created.map((c) => c.path));
			const unsent = error.failed.filter(
				(f: { path: string }) => !sent.has(f.path),
			);
			expect(unsent.length).toBeGreaterThanOrEqual(24);
			for (const { index } of unsent) {
				expect(
					events
						.filter((e) => e.index === index)
						.map((e) => `${e.type} ${e.attempt}`),
				).toEqual(["error 0"]);
			}
		});

		it("sends no more files at once than the concurrency", async () => {
			let active = 0;
			let peak = 0;
			const entries = Array.from({ length: 12 }, (_, i) => ({
				path: `d/f${i}.txt`,
				file: file(`${i}`),
			}));
			const { fetchMock, respond } = server();
			fetchMock.mockImplementation(async (url, init) => {
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
			// No file is registered until as many are waiting as the cap lets in (or every file
			// was sent), so the peak is the cap itself, whatever order the promises run in.
			// The first file, which creates the folder, is registered at once. Pauses end on the
			// next turn of the event loop, as real timers do, so a file polling its registration
			// lets the others send theirs.
			setTimeoutSpy.mockImplementation(((callback: () => void, ms: number) => {
				delays.push(ms);
				setImmediate(callback);
				return 0;
			}) as unknown as typeof setTimeout);
			let posted = 0;
			let waiting = 0;
			let peak = 0;
			mockFetch(async (url, init) => {
				if (init.method === "PUT") return synced(40, {});
				if (init.method === "POST") {
					const path = pathOf(init);
					posted++;
					waiting++;
					peak = Math.max(peak, waiting);
					return processing(
						`${url}/${encodeURIComponent(path)}`,
						`bafy-${path}`,
					);
				}
				const ready = posted === 1 || waiting >= 16 || posted === 40;
				if (ready) waiting--;
				return registration(ready ? "ready" : "processing");
			});

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
			const polls = new Map<string, number>();
			const marks: string[] = [];
			mockFetch(async (url, init) => {
				if (init.method === "PUT") return synced(2, {});
				if (init.method === "POST") {
					const path = pathOf(init);
					marks.push(`${delays.length} POST ${path}`);
					return processing(
						`${url}/${encodeURIComponent(path)}`,
						`bafy-${path}`,
					);
				}
				const n = (polls.get(url) ?? 0) + 1;
				polls.set(url, n);
				return registration(n >= 6 ? "ready" : "processing");
			});

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
			mockFetch(async (url, init) => {
				if (init.method === "PUT") return synced(1, {});
				if (init.method === "POST") {
					timeline.push("POST");
					return processing(`${url}/upload`);
				}
				heads++;
				timeline.push(`HEAD ${heads}`);
				return registration(heads < 3 ? "processing" : "ready");
			});

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
			const fetchMock = mockFetch(async (url, init) => {
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
			});

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
				fetchMock.mock.calls.filter(
					([, init]) =>
						init.method === "POST" && pathOf(init) === "d/never.txt",
				),
			).toHaveLength(4);
			expect(peak).toBeLessThanOrEqual(4);
		});

		it("asks for the CID version given, on every file of the folder", async () => {
			const urls: string[] = [];
			const versions: string[] = [];
			mockFetch(async (url, init) => {
				if (init.method === "PUT") return synced(2);
				urls.push(url);
				versions.push(metadataOf(init).cid_version);
				return registeredAt(url, init);
			});

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
			mockFetch(async (url, init) => {
				if (init.method === "PUT") return synced(1);
				sent.push(metadataOf(init));
				return registeredAt(url, init);
			});

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
			mockFetch(async (url, init) => {
				if (init.method === "PUT") return synced(1);
				posts.push(1);
				return registeredAt(url, init);
			});

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
			mockFetch(async (url, init) => {
				if (init.method === "PUT") return synced(1);
				posts.push(1);
				return registeredAt(url, init);
			});

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
			mockFetch(async (url, init) =>
				init.method === "PUT" ? synced(1) : registeredAt(url, init),
			);

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

		it("refuses an inline file held in memory followed by a part that reports none of its bytes", async () => {
			const posts: number[] = [];
			mockFetch(async (url, init) => {
				if (init.method === "PUT") return synced(1);
				posts.push(1);
				return registeredAt(url, init);
			});

			// A Buffer, then a file on disk of 4 GiB (fs.openAsBlob reports 0 bytes): every
			// slice() of the File ends with the Buffer
			const mixed = NodeLikeFile.of(
				{ length: 1024 * 1024 },
				{ length: 2 ** 32, reported: 0, disk: true },
			);
			const error = await uploadFolder(
				config,
				[{ path: "d/mixed.bin", file: mixed }],
				"public",
			).catch((e) => e);

			expect(error).toBeInstanceOf(ValidationError);
			expect(error.message).toContain("larger than its reported size");
			expect(posts).toHaveLength(0);
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
			mockFetch(async (url, init) => {
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
			});
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
			mockFetch(async (url, init) => {
				if (init.method === "POST") return createdAt(`${url}/upload`);
				if (init.method === "PATCH") {
					patches++;
					return new Response(
						JSON.stringify({ error: { message: "write capacity" } }),
						{ status: 503, headers: { "Retry-After": "30" } },
					);
				}
				return storedUpTo(0);
			});

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
			mockFetch(async () => {
				throw new TypeError("Failed to fetch");
			});

			await expect(
				uploadFolder(config, [{ path: "d/a.txt", file: file("a") }], "public", {
					retries: 0,
				}),
			).rejects.toThrow("Could not reach the upload server: Failed to fetch");
		});

		it("fails a file at once when the server refuses a chunk for good", async () => {
			let patches = 0;
			mockFetch(async (url, init) => {
				if (init.method === "POST") return createdAt(`${url}/upload`);
				if (init.method === "PATCH") {
					patches++;
					return new Response("too large", { status: 413 });
				}
				return storedUpTo(0);
			});

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
			mockFetch(async (url, init) => {
				if (init.method === "POST") return processing(`${url}/upload`);
				heads++;
				return new Response(null, { status: 400 });
			});

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
			mockFetch(async (url, init) => {
				if (init.method === "POST") return processing(`${url}/upload`);
				heads++;
				return new Response(null, { status: 401 });
			});

			const error = await uploadFolder(
				config,
				[{ path: "d/a.txt", file: file("a") }],
				"public",
			).catch((e) => e);

			expect(error.statusCode).toBe(401);
			expect(heads).toBe(1);
		});

		it("keeps the headers of a refused creation as a plain object", async () => {
			mockFetch(
				async () =>
					new Response(JSON.stringify({ error: { message: "down" } }), {
						status: 503,
						headers: { "Content-Type": "application/json", "Retry-After": "3" },
					}),
			);

			const error = await uploadFolder(
				config,
				[{ path: "d/a.txt", file: file("a") }],
				"public",
				{ retries: 0 },
			).catch((e) => e);

			expect(error.details.metadata.responseHeaders).toEqual({
				"content-type": "application/json",
				"retry-after": "3",
			});
			expect(error.details.metadata).not.toHaveProperty("requestHeaders");
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
			// Offline for this request: back online once the upload waits for it
			const dropConnection = () => {
				onLine = false;
				setImmediate(() => {
					onLine = true;
					online.dispatchEvent(new Event("online"));
				});
				throw new TypeError("Failed to fetch");
			};

			it("waits until it is back online, without spending the file's retries", async () => {
				let creations = 0;
				mockFetch(async (url, init) => {
					if (init.method === "PUT") return synced(1);
					creations++;
					if (creations <= 3) dropConnection();
					return registeredAt(url, init);
				});

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
				mockFetch(async (url, init) => {
					const headers = headersOf(init);
					if (init.method === "PUT") return synced(1);
					if (init.method === "POST") return createdAt(`${url}/upload`);
					if (init.method === "HEAD") return storedUpTo(0);
					patches.push(headers["Upload-Offset"]);
					if (patches.length <= 7) dropConnection();
					return new Response(null, {
						status: 204,
						headers: {
							"Upload-Offset":
								headers["Upload-Offset"] === "0" ? "52428801" : "52428802",
							"Upload-Cid": "bafybig",
						},
					});
				});

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

		describe("while the server finishes an earlier upload of the same path", () => {
			it("waits as long as the server asks, without spending the file's retries", async () => {
				let creations = 0;
				mockFetch(async (url, init) => {
					if (init.method === "PUT") return synced(1);
					creations++;
					if (creations <= 2) return finalizing({ "Retry-After": "20" });
					return registeredAt(url, init);
				});
				const events: FolderUploadEvent[] = [];

				const result = await uploadFolder(
					config,
					[{ path: "d/a.txt", file: file("a") }],
					"public",
					{
						folderId: givenFolderId,
						retries: 0,
						onProgress: (e) => events.push(e),
					},
				);

				expect(result.files[0].cid).toBe("bafy-d/a.txt");
				const retries = events.filter((e) => e.type === "retry");
				expect(
					retries.map((e) => [e.delayMs, e.waitingForPreviousUpload]),
				).toEqual([
					[20000, true],
					[20000, true],
				]);
				expect(retries[0].error?.message).toBe(
					"Could not start the upload (HTTP 409): Upload is finalizing; poll HEAD on its Location for the outcome",
				);
				expect(delays.filter((ms) => ms === 20000)).toHaveLength(2);
			});

			it("counts the refusals against the retries once it took longer than a registration may", async () => {
				let now = 0;
				const clock = jest.spyOn(Date, "now").mockImplementation(() => now);
				setTimeoutSpy.mockImplementation(((
					callback: () => void,
					ms: number,
				) => {
					delays.push(ms);
					now += ms;
					callback();
					return 0;
				}) as unknown as typeof setTimeout);
				mockFetch(async () => finalizing());
				const events: FolderUploadEvent[] = [];
				try {
					const error = await uploadFolder(
						config,
						[{ path: "d/a.txt", file: file("a") }],
						"public",
						{
							folderId: givenFolderId,
							retries: 1,
							onProgress: (e) => events.push(e),
						},
					).catch((e) => e);

					expect(error).toBeInstanceOf(FolderUploadError);
					const retries = events.filter((e) => e.type === "retry");
					const waits = retries.filter((e) => e.waitingForPreviousUpload);
					// The waits fill the registration timeout of a one-byte file
					const waited = waits.reduce((sum, e) => sum + (e.delayMs ?? 0), 0);
					expect(waited).toBeGreaterThanOrEqual(registrationTimeout(1));
					expect(waited).toBeLessThan(registrationTimeout(1) + 11000);
					// Then one counted retry, and the file fails
					expect(retries.length - waits.length).toBe(1);
					expect(retries.at(-1)?.waitingForPreviousUpload).toBeUndefined();
					expect(events.at(-1)?.type).toBe("error");
				} finally {
					clock.mockRestore();
				}
			});

			it("stops waiting once cancelled", async () => {
				// Pauses never end on their own: only the abort ends them
				setTimeoutSpy.mockImplementation(((_: () => void, ms: number) => {
					delays.push(ms);
					return 0;
				}) as unknown as typeof setTimeout);
				const controller = new AbortController();
				let creations = 0;
				mockFetch(async () => {
					creations++;
					setImmediate(() => controller.abort());
					return finalizing();
				});

				const error = await uploadFolder(
					config,
					[{ path: "d/a.txt", file: file("a") }],
					"public",
					{ folderId: givenFolderId, signal: controller.signal },
				).catch((e) => e);

				expect(error).toBeInstanceOf(FolderUploadError);
				expect(error.failed[0].error.name).toBe("AbortError");
				expect(creations).toBe(1);
			});

			it("counts any other conflict against the file's retries", async () => {
				let creations = 0;
				mockFetch(async () => {
					creations++;
					return new Response(
						"Upload changed; retrieve the current offset with HEAD",
						{ status: 409 },
					);
				});
				const events: FolderUploadEvent[] = [];

				const error = await uploadFolder(
					config,
					[{ path: "d/a.txt", file: file("a") }],
					"public",
					{ retries: 1, onProgress: (e) => events.push(e) },
				).catch((e) => e);

				expect(error.statusCode).toBe(409);
				expect(creations).toBe(2);
				const retry = events.find((e) => e.type === "retry");
				expect(retry?.waitingForPreviousUpload).toBeUndefined();
			});
		});
	});

	describe("resuming a file", () => {
		it("continues the upload its last attempt left unfinished", async () => {
			const size = CHUNK + 10;
			let stored = 0;
			let lost = 0;
			const calls: string[] = [];
			mockFetch(async (url, init) => {
				const offset = headersOf(init)["Upload-Offset"];
				calls.push(`${init.method}${offset ? ` ${offset}` : ""}`);
				if (init.method === "PUT") return synced(1, {});
				if (init.method === "POST") return createdAt(`${url}/upload`);
				if (init.method === "HEAD") return storedUpTo(stored);
				// The second chunk is lost more times than the chunk retries allow
				if (offset === `${CHUNK}` && lost < 6) {
					lost++;
					throw new TypeError("fetch failed");
				}
				stored = offset === "0" ? CHUNK : size;
				return chunkStored(stored, size);
			});
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
			expect(calls.slice(-3)).toEqual(["HEAD", `PATCH ${CHUNK}`, "PUT"]);
		});

		it("keeps the unfinished upload when the server cannot say where it stands", async () => {
			const size = CHUNK + 10;
			let stored = 0;
			let lost = 0;
			let heads = 0;
			const calls: string[] = [];
			mockFetch(async (url, init) => {
				const offset = headersOf(init)["Upload-Offset"];
				calls.push(`${init.method}${offset ? ` ${offset}` : ""}`);
				if (init.method === "PUT") return synced(1, {});
				if (init.method === "POST") return createdAt(`${url}/upload`);
				if (init.method === "HEAD") {
					heads++;
					// No answer to the chunk retries' HEADs nor to the first one of the next attempt
					if (heads <= 6) throw new TypeError("fetch failed");
					return storedUpTo(stored);
				}
				if (offset === `${CHUNK}` && lost < 6) {
					lost++;
					throw new TypeError("fetch failed");
				}
				stored = offset === "0" ? CHUNK : size;
				return chunkStored(stored, size);
			});

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
				`PATCH ${CHUNK}`,
				"PUT",
			]);
		});

		it("continues the upload when checking it after a failed CHUNK is refused the JWT", async () => {
			const size = 2 * CHUNK + 10;
			let stored = 0;
			let failedOnce = false;
			const calls: string[] = [];
			mockFetch(async (url, init) => {
				const headers = headersOf(init);
				const old = headers.Authorization === "Bearer t1";
				calls.push(
					`${init.method}${headers["Upload-Offset"] ? ` ${headers["Upload-Offset"]}` : ""}`,
				);
				if (init.method === "PUT") return synced(1);
				if (init.method === "POST") return createdAt(`${url}/upload`);
				if (init.method === "HEAD") {
					// The JWT expired while the CHUNK failed
					if (old) return new Response(null, { status: 401 });
					return storedUpTo(stored);
				}
				if (headers["Upload-Offset"] === `${CHUNK}` && !failedOnce) {
					failedOnce = true;
					return new Response("busy", { status: 503 });
				}
				stored = Math.min(size, Number(headers["Upload-Offset"]) + CHUNK);
				return chunkStored(stored, size);
			});

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

		it("sends a file again when the response holding its CID was lost and the server reports an earlier folder's", async () => {
			let patches = 0;
			const posts: string[] = [];
			mockFetch(async (url, init) => {
				if (init.method === "PUT") return synced(2);
				if (init.method === "POST") {
					const path = pathOf(init);
					posts.push(path);
					if (path === "d/b.txt") return registeredAt(url, init);
					return createdAt(`${url}/a`, { "Upload-Offset": "0" });
				}
				// The first PATCH of d/a.txt is stored, but its response is lost
				if (init.method === "PATCH" && ++patches === 1) {
					throw new TypeError("fetch failed");
				}
				if (init.method === "PATCH") {
					return new Response(null, {
						status: 204,
						headers: {
							"Upload-Offset": "1",
							"Upload-Cid": "bafy-a",
							"Upload-Status": "processing",
						},
					});
				}
				// Registered: alone in the folder, it matched an earlier one-file folder
				return registration("ready", {
					"Upload-Cid": "bafyearlier",
					"Upload-Metadata": `filename ${encode("d")},file_id ${encode("earlier-folder")},cid ${encode("bafyearlier")}`,
				});
			});

			// Not counted against retries: nothing failed
			const result = await uploadFolder(
				config,
				[
					{ path: "d/a.txt", file: file("a") },
					{ path: "d/b.txt", file: file("bb") },
				],
				"public",
				{ retries: 0 },
			);

			expect(result.files.map((f) => f.cid)).toEqual([
				"bafy-a",
				"bafy-d/b.txt",
			]);
			expect(posts).toEqual(["d/a.txt", "d/a.txt", "d/b.txt"]);
		});

		it("reports no CID, rather than an earlier folder's, when the response completing the file held none", async () => {
			let posts = 0;
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				if (init.method === "PUT") return refused(404, "bucket not found");
				if (init.method === "POST") {
					posts++;
					return new Response(null, {
						status: 201,
						headers: {
							Location: `${url}/only`,
							"Upload-Offset": "1",
							"Upload-Status": "processing",
						},
					});
				}
				return new Response(null, {
					status: 200,
					headers: {
						"Upload-Offset": "1",
						"Upload-Status": "ready",
						"Upload-Cid": "bafyearlier",
						"Upload-Metadata": `filename ${encode("d")},file_id ${encode("earlier-folder")},cid ${encode("bafyearlier")}`,
					},
				});
			}) as unknown as typeof fetch;

			const result = await uploadFolder(
				config,
				[{ path: "d/only.txt", file: file("a") }],
				"public",
			);

			expect(result).toMatchObject({ cid: "bafyearlier", is_duplicate: true });
			expect(result.files[0].cid).toBe("");
			expect(posts).toBe(1);
		});

		it("doesn't send a resumed file again when the response completing it arrived without a CID", async () => {
			const calls: string[] = [];
			global.fetch = jest.fn(async (url: string, init: RequestInit) => {
				const headers = init.headers as Record<string, string>;
				const jwt = headers.Authorization.replace("Bearer ", "");
				calls.push(`${init.method} ${jwt}`);
				if (init.method === "PUT") return refused(404, "bucket not found");
				if (init.method === "POST") {
					return new Response(null, {
						status: 201,
						headers: { Location: `${url}/only`, "Upload-Offset": "0" },
					});
				}
				if (init.method === "PATCH") {
					if (jwt === "old-jwt") return refused(401, "Invalid/expired token");
					return new Response(null, {
						status: 204,
						headers: { "Upload-Offset": "1", "Upload-Status": "processing" },
					});
				}
				// HEAD: where the upload to continue stands, then its registration
				return calls.includes("PATCH new-jwt")
					? new Response(null, {
							status: 200,
							headers: {
								"Upload-Offset": "1",
								"Upload-Status": "ready",
								"Upload-Cid": "bafyearlier",
								"Upload-Metadata": `filename ${encode("d")},file_id ${encode("earlier-folder")},cid ${encode("bafyearlier")}`,
							},
						})
					: new Response(null, {
							status: 200,
							headers: { "Upload-Offset": "0", "Upload-Status": "receiving" },
						});
			}) as unknown as typeof fetch;

			const result = await uploadFolder(
				{ ...config, pinataJwt: "old-jwt" },
				[{ path: "d/only.txt", file: file("a") }],
				"public",
				{ refreshJwt: async () => "new-jwt" },
			);

			expect(result.files[0].cid).toBe("");
			expect(calls.filter((c) => c.startsWith("POST"))).toHaveLength(1);
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
			const { fetchMock, respond } = server((creation) =>
				creation.path === "d/bad.txt"
					? refused(400, "invalid name")
					: undefined,
			);
			fetchMock.mockImplementation(async (url, init) =>
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
			mockFetch(async (url, init) => {
				if (init.method === "PUT") return synced(created.length);
				const path = pathOf(init);
				if (path.endsWith("docs/b.txt") && refuseB) {
					return refused(400, "invalid name");
				}
				created.push(path);
				return registeredAt(url, init);
			});
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
			const { fetchMock, respond } = server((creation) =>
				processing(
					`https://uploads.test/v3/files/${creation.folderId}/${encodeURIComponent(creation.path)}`,
					`bafy-own-${creation.path}`,
				),
			);
			fetchMock.mockImplementation(async (url, init) =>
				init.method === "HEAD"
					? registration("ready", {
							"Upload-Cid": "bafy-earlier-folder",
							"Upload-Metadata": `file_id ${encode("earlier-upload")}`,
						})
					: init.method === "PUT"
						? synced(2, { size: 2 })
						: respond(url, init),
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
			const { fetchMock, respond } = server();
			fetchMock.mockImplementation(async (url, init) =>
				init.method === "PUT"
					? syncedAs({
							id: "earlier-folder",
							name: "photos",
							cid: "bafy-earlier",
							size: 3,
							number_of_files: 2,
							is_duplicate: true,
						})
					: respond(url, init),
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
			mockFetch(async (url, init) => {
				if (init.method === "PUT") {
					return new Response(
						JSON.stringify({ error: { message: "bucket not found" } }),
						{ status: 404 },
					);
				}
				// The one file is registered as the earlier one-file folder of the same content
				return createdAt(`${url}/d/only.txt`, {
					"Upload-Offset": "1",
					"Upload-Cid": "bafkonly",
					"Upload-Metadata": `filename ${encode("d")},file_id ${encode("earlier-folder")},cid ${encode("bafyearlier")}`,
				});
			});

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
			const { fetchMock, respond } = server((creation) =>
				creation.path === "d/bad.txt"
					? refused(400, "invalid name")
					: undefined,
			);
			fetchMock.mockImplementation(async (url, init) =>
				init.method === "PUT"
					? syncedAs({
							id: "earlier-folder",
							name: "first",
							cid: "bafyearlier",
							size: 1,
							number_of_files: 1,
							is_duplicate: true,
						})
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
			mockFetch(async (url, init) => {
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
			});

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
			mockFetch(async (url, init) =>
				init.method === "PUT" ? synced(1) : registeredAt(url, init),
			);

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
		it("rejects with an AuthenticationError when the server refuses the JWT, as file() does", async () => {
			server(() => refused(401, "Not Authorized"));

			const error = await uploadFolder(
				config,
				[{ path: "d/a.txt", file: file("a") }],
				"public",
			).catch((e) => e);

			expect(error).toBeInstanceOf(AuthenticationError);
			expect(error.statusCode).toBe(401);
			expect(error.message).toBe(
				"Could not start the upload (HTTP 401): Not Authorized",
			);
			expect(error.details.code).toBe("AUTH_ERROR");
		});

		it("fails each file of a given folder with an AuthenticationError when the server refuses the JWT", async () => {
			server(() => refused(403, "Forbidden"));

			const error = await uploadFolder(
				config,
				[
					{ path: "d/a.txt", file: file("a") },
					{ path: "d/b.txt", file: file("bb") },
					{ path: "d/c.txt", file: file("ccc") },
				],
				"public",
				{ folderId: givenFolderId, concurrency: 1 },
			).catch((e) => e);

			expect(error).toBeInstanceOf(FolderUploadError);
			expect(error.failed).toHaveLength(3);
			for (const failed of error.failed) {
				expect(failed.error).toBeInstanceOf(AuthenticationError);
				expect(failed.error.statusCode).toBe(403);
			}
		});

		it("rejects with an AuthenticationError when a chunk is refused the JWT", async () => {
			mockFetch(async (url, init) => {
				if (init.method === "POST") return createdAt(`${url}/upload`);
				if (init.method === "PATCH") return refused(401, "Not Authorized");
				return storedUpTo(0);
			});

			const error = await uploadFolder(
				config,
				[{ path: "d/big.bin", file: big() }],
				"public",
			).catch((e) => e);

			expect(error).toBeInstanceOf(AuthenticationError);
			expect(error.message).toBe(
				"Could not send the file (HTTP 401): Not Authorized",
			);
			expect(error.details.metadata.uploadUrl).toMatch(/\/upload$/);
		});

		it("rejects with an AuthenticationError when the final sync is refused the JWT", async () => {
			const { fetchMock, respond } = server();
			fetchMock.mockImplementation(async (url, init) =>
				init.method === "PUT"
					? refused(401, "Not Authorized")
					: respond(url, init),
			);

			const error = await uploadFolder(
				config,
				[{ path: "d/a.txt", file: file("a") }],
				"public",
			).catch((e) => e);

			expect(error).toBeInstanceOf(AuthenticationError);
			expect(error.message).toBe(
				"Could not finish the folder (HTTP 401): Not Authorized",
			);
		});

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
					.map(([, init]) => headersOf(init))
					.filter(
						(h) => decodeMetadata(h["Upload-Metadata"] ?? "").filename === path,
					)
					.map((h) => h.Authorization);
			expect(auth("d/a.txt")).toEqual(["Bearer first-jwt"]);
			expect(auth("d/b.txt")).toEqual(["Bearer fresh-jwt"]);
		});

		it("checks a file's registration with a JWT replaced while it was being sent", async () => {
			const live: PinataConfig = { ...config, pinataJwt: "first-jwt" };
			mockFetch(async (url, init) => {
				const auth = headersOf(init).Authorization;
				if (init.method === "POST") {
					// The token expires: the app sets a fresh one
					live.pinataJwt = "fresh-jwt";
					return processing(`${url}/upload`);
				}
				if (init.method === "HEAD") {
					return auth === "Bearer fresh-jwt"
						? registration("ready", { "Upload-Cid": "bafyfile" })
						: new Response(null, { status: 401 });
				}
				return synced(1);
			});

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
			mockFetch(async (url, init) => {
				const headers = headersOf(init);
				if (init.method === "PUT") return synced(2);
				if (init.method === "POST") {
					const path = pathOf(init);
					requests.push(`POST ${path} ${headers.Authorization}`);
					if (path === "d/0.txt") return registeredAt(url, init);
					// The creation stores none of the body
					return createdAt(`https://u.test/up/${encodeURIComponent(path)}`, {
						"Upload-Offset": "0",
					});
				}
				requests.push(`${init.method} ${url} ${headers.Authorization}`);
				if (init.method === "HEAD") return storedUpTo(0);
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
			});
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
				const respond: Handler = async (url, init) => {
					const headers = headersOf(init);
					auths.push(`${init.method} ${headers.Authorization}`);
					if (headers.Authorization === "Bearer old-jwt") {
						return refused(401, "Invalid/expired token");
					}
					if (init.method === "PUT") return synced(3);
					return registeredAt(url, init);
				};
				return { fetchMock: mockFetch(respond), respond, auths };
			};

			it("asks refreshJwt once for a new one and sends the refused files again", async () => {
				const { auths } = authServer();
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
				const { fetchMock, respond } = authServer();
				const settings = live();
				// setNewJwt lands while the refused request is under way
				fetchMock.mockImplementation(async (url, init) => {
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
				mockFetch(async (url, init) => {
					const headers = headersOf(init);
					calls.push(`${init.method} ${headers.Authorization}`);
					if (init.method === "PUT") return synced(1);
					if (init.method === "POST") return processing(`${url}/upload`);
					if (headers.Authorization === "Bearer old-jwt") {
						return new Response(null, { status: 401 });
					}
					return registration("ready");
				});

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

			it("keeps a JWT set while refreshJwt was under way, rather than the one it returns", async () => {
				const { auths } = authServer();
				const settings = live();
				const refreshJwt = jest.fn(async () => {
					// setNewJwt lands before the refresh answers
					settings.pinataJwt = "new-jwt";
					return "stale-jwt";
				});

				await uploadFolder(
					settings,
					[{ path: "d/a.txt", file: file("a") }],
					"public",
					{ refreshJwt },
				);

				expect(settings.pinataJwt).toBe("new-jwt");
				expect(auths.at(-1)).toBe("PUT Bearer new-jwt");
			});
		});

		it("renews a JWT the final sync is refused, without spending its retries", async () => {
			const auth = expiring(1);
			const calls: string[] = [];
			mockFetch(async (url, init) => {
				const headers = headersOf(init);
				calls.push(`${init.method} ${headers.Authorization}`);
				if (!auth.accepts(headers))
					return refused(401, "Invalid/expired token");
				return init.method === "PUT" ? synced(1) : registeredAt(url, init);
			});

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
			mockFetch(async (url, init) => {
				const path = init.method === "POST" ? pathOf(init) : "";
				if (path === "d/bad.txt") return refused(400, "invalid name");
				if (!auth.accepts(headersOf(init)))
					return refused(401, "Invalid/expired token");
				return init.method === "PUT" ? synced(1) : registeredAt(url, init);
			});

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
			mockFetch(async (url, init) => {
				const headers = headersOf(init);
				if (!auth.accepts(headers))
					return refused(401, "Invalid/expired token");
				if (init.method === "PUT") return synced(1);
				if (init.method === "POST") return createdAt(`${url}/upload`);
				if (init.method === "HEAD") return storedUpTo(stored);
				stored = Math.min(size, Number(headers["Upload-Offset"]) + CHUNK);
				return chunkStored(stored, size);
			});

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
			mockFetch(async (url, init) => {
				const jwt = headersOf(init).Authorization.replace("Bearer ", "");
				const n = (used.get(jwt) ?? 0) + 1;
				used.set(jwt, n);
				if (init.method === "POST") posts.push(jwt);
				if (n > (limits[jwt] ?? Number.POSITIVE_INFINITY)) {
					return refused(401, "Invalid/expired token");
				}
				return init.method === "PUT" ? synced(3) : registeredAt(url, init);
			});

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
			mockFetch(async (url, init) => {
				if (init.method === "POST") return createdAt(`${url}/upload`);
				setImmediate(() => controller.abort());
				return new Response("busy", { status: 503 });
			});

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
			mockFetch(async () => refused(401, "Invalid/expired token"));

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
			const { fetchMock, respond } = server();
			const controller = new AbortController();
			let syncs = 0;
			fetchMock.mockImplementation(async (url, init) => {
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

		it("sends files cancelled after their last byte again into the folder once the server has finished their earlier upload", async () => {
			const MiB = 1024 * 1024;
			const files = Array.from({ length: 24 }, (_, i) => ({
				path: `d/part-${i}.bin`,
				file: new File([new Uint8Array(MiB)], `part-${i}.bin`),
			}));
			// Uploads the server is still registering. A new upload of one of those paths is
			// refused until the earlier upload ends, after 5 refusals.
			const finishing = new Set<string>();
			const refusals = new Map<string, number>();
			const registered = new Set<string>();
			mockFetch(async (url, init) => {
				if (init.method === "PUT") return synced(registered.size);
				if (init.method === "HEAD") {
					const path = decodeURIComponent(url.slice(url.lastIndexOf("/") + 1));
					finishing.delete(path);
					registered.add(path);
					return new Response(null, {
						status: 200,
						headers: {
							"Upload-Offset": `${MiB}`,
							"Upload-Status": "ready",
							"Upload-Cid": `bafy-${path}`,
						},
					});
				}
				const path = pathOf(init);
				if (finishing.has(path)) {
					const n = (refusals.get(path) ?? 0) + 1;
					refusals.set(path, n);
					if (n <= 5) return finalizing();
					finishing.delete(path);
				}
				finishing.add(path);
				return createdAt(`${url}/${encodeURIComponent(path)}`, {
					"Upload-Offset": `${MiB}`,
					"Upload-Cid": `bafy-${path}`,
					"Upload-Status": "processing",
				});
			});
			const controller = new AbortController();

			const cancelledUpload = await uploadFolder(config, files, "public", {
				concurrency: 2,
				signal: controller.signal,
				onProgress: (e) => {
					if (e.type === "sent" && e.completed >= 3) controller.abort();
				},
			}).catch((e) => e);

			expect(cancelledUpload).toBeInstanceOf(FolderUploadError);
			const failed: { index: number; path: string }[] = cancelledUpload.failed;
			// Cancelled after their last byte: the server is still finishing them
			const unfinished = failed
				.filter((f) => finishing.has(f.path))
				.map((f) => f.path);
			expect(unfinished.length).toBeGreaterThan(0);

			const events: FolderUploadEvent[] = [];
			const result = await uploadFolder(
				config,
				failed.map((f) => ({ path: f.path, file: files[f.index].file })),
				"public",
				{
					folderId: cancelledUpload.folderId,
					concurrency: 2,
					onProgress: (e) => events.push(e),
				},
			);

			expect(result.number_of_files).toBe(24);
			expect(result.files).toHaveLength(failed.length);
			for (const path of unfinished) {
				expect(refusals.get(path)).toBe(6);
				// More waits than the 3 retries, none of them counted
				const retries = events.filter(
					(e) => e.path === path && e.type === "retry",
				);
				expect(retries).toHaveLength(5);
				for (const retry of retries) {
					expect(retry.waitingForPreviousUpload).toBe(true);
					expect(retry.delayMs).toBeGreaterThan(0);
					expect((retry.error as PinataError).statusCode).toBe(409);
				}
			}
		});
	});
});
