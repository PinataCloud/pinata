// Regressions from the review of #105 (resumable uploads): each test reproduces a defect.
import type { PinataConfig } from "../../src";
import { uploadFile, uploadFolder } from "../../src/core/functions";
import { ValidationError } from "../../src/utils/custom-errors";
import { NodeLikeFile } from "./nodeLikeFile";

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

describe("resumable uploads, review of #105", () => {
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

	it("refuses an inline file whose stream holds more bytes than its size", async () => {
		const posts: number[] = [];
		global.fetch = jest.fn(async (url: string, init: RequestInit) => {
			if (init.method === "PUT") return synced(1);
			posts.push(1);
			return registered(url, init);
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
			return registered(url, init);
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
			init.method === "PUT" ? synced(1) : registered(url, init),
		) as unknown as typeof fetch;

		const result = await uploadFolder(
			config,
			[{ path: "d/empty.txt", file: file("") }],
			"public",
		);

		expect(result.files[0]).toMatchObject({ size: 0, cid: "bafy-d/empty.txt" });
	});

	it("lets a single-file upload fail after its retries while the browser is offline", async () => {
		const scope = globalThis as unknown as Record<string, unknown>;
		const navigatorDescriptor = Object.getOwnPropertyDescriptor(
			globalThis,
			"navigator",
		);
		const online = new EventTarget();
		Object.defineProperty(globalThis, "navigator", {
			value: { onLine: false },
			configurable: true,
		});
		scope.addEventListener = online.addEventListener.bind(online);
		scope.removeEventListener = online.removeEventListener.bind(online);
		let patches = 0;
		global.fetch = jest.fn(async (url: string, init: RequestInit) => {
			if (init.method === "POST") {
				return new Response(null, {
					status: 201,
					headers: { Location: `${url}/upload` },
				});
			}
			if (init.method === "PATCH") patches++;
			throw new TypeError("Failed to fetch");
		}) as unknown as typeof fetch;
		try {
			const large = new File([new Uint8Array(94371841)], "large.bin");
			await expect(uploadFile(config, large, "public")).rejects.toThrow(
				"after 5 retries",
			);
			expect(patches).toBe(6);
		} finally {
			if (navigatorDescriptor) {
				Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
			} else {
				delete scope.navigator;
			}
			delete scope.addEventListener;
			delete scope.removeEventListener;
		}
	});
});
