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
			for (const name of ["..", ".", "a/b", "a\\b", "..\\x"]) {
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

	it("fails without sending the others when the first file cannot be uploaded", async () => {
		const { created } = server(() =>
			refused(413, "Feature (Resumable Buckets) not turned on"),
		);

		await expect(
			uploadFolder(
				config,
				[
					{ path: "d/a.txt", file: file("a") },
					{ path: "d/b.txt", file: file("bb") },
				],
				"private",
			),
		).rejects.toThrow(
			"Could not start the upload (HTTP 413): Feature (Resumable Buckets) not turned on",
		);
		expect(created).toHaveLength(1);
	});

	it("refuses a file the server registered outside the folder", async () => {
		server(
			(creation) =>
				new Response(null, {
					status: 201,
					headers: {
						Location: `https://uploads.test/v3/files/${creation.folderId}/x`,
						"Upload-Offset": "1",
						"Upload-Cid": "bafyearlier",
						"Upload-Metadata": `filename ${encode(creation.path)},file_id ${encode("earlier-upload")}`,
					},
				}),
		);

		await expect(
			uploadFolder(config, [{ path: "d/a.txt", file: file("a") }], "private"),
		).rejects.toThrow(
			/registered d\/a\.txt as file earlier-upload, not in folder/,
		);
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
