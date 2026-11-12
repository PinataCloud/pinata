import { uploadFile } from "../../src/core/functions";
import {
	encodeMetadataValue,
	parseUploadMetadata,
	serverReason,
} from "../../src/core/functions/uploads/tusMetadata";
import type { PinataConfig } from "../../src";
import { NetworkError } from "../../src/utils/custom-errors";

const decode = (value: string) => Buffer.from(value, "base64").toString("utf8");

// File names a user can have: CJK, emoji, and a macOS NFD name (e + U+0301)
const names = ["動画.mp4", "🎬 final.mov", "Cafe\u0301.mov", "plain.bin"];

describe("encodeMetadataValue", () => {
	it.each(names)("encodes %s as base64 of its UTF-8 bytes", (name) => {
		expect(decode(encodeMetadataValue(name))).toBe(name);
	});

	it("matches btoa for ASCII", () => {
		expect(encodeMetadataValue("v1")).toBe(btoa("v1"));
	});
});

describe("parseUploadMetadata", () => {
	it("decodes every value as UTF-8", () => {
		const header = `filename ${encodeMetadataValue("動画.mp4")},file_id ${encodeMetadataValue("abc")},empty`;

		expect(parseUploadMetadata(header)).toEqual({
			filename: "動画.mp4",
			file_id: "abc",
			empty: "",
		});
	});

	it("returns nothing for a missing header and skips values that are not base64", () => {
		expect(parseUploadMetadata(null)).toEqual({});
		expect(parseUploadMetadata("bad %%%,ok b2s=")).toEqual({ ok: "ok" });
	});
});

describe("serverReason", () => {
	it("reads the message of a JSON error", () => {
		expect(
			serverReason(
				'{"error":{"code":413,"message":"free users are limited to max 1GB uploads"}}',
			),
		).toBe("free users are limited to max 1GB uploads");
		expect(serverReason('{"message":"nope"}')).toBe("nope");
		expect(serverReason('{"error":"Unauthorized"}')).toBe("Unauthorized");
	});

	it("keeps short plain text and drops an HTML page", () => {
		expect(serverReason("Service unavailable\n")).toBe("Service unavailable");
		expect(
			serverReason("<html><body><h1>503 Service Temporarily Unavailable</h1>"),
		).toBe("");
	});
});

describe("uploadFile, resumable", () => {
	const largeSize = 94371841; // just over the 90 MiB threshold: two chunks
	const chunkSize = 50 * 1024 * 1024 + 1;
	const uploadUrl = "https://uploads.pinata.cloud/v3/files/upload-id/large.bin";
	const largeFile = new File([new ArrayBuffer(largeSize)], "large.bin");
	const withJwt: PinataConfig = { pinataJwt: "test-jwt" };
	// Auth through custom headers only: no JWT to look the file up with afterwards
	const withoutJwt: PinataConfig = { customHeaders: { "x-api-key": "key" } };

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

	const script = (...steps: Response[]) => {
		const fetchMock = jest.fn(async () => {
			const step = steps.shift();
			if (!step) throw new Error("unexpected request");
			return step;
		});
		global.fetch = fetchMock as unknown as typeof fetch;
		return fetchMock;
	};
	const created = () =>
		new Response(null, { status: 201, headers: { Location: uploadUrl } });
	const accepted = (offset: number, headers: Record<string, string> = {}) =>
		new Response(null, {
			status: 204,
			headers: { "Upload-Offset": offset.toString(), ...headers },
		});
	const registered = (fileId: string, name: string) =>
		`filename ${encodeMetadataValue(name)},file_id ${encodeMetadataValue(fileId)},cid ${encodeMetadataValue("bafyfinal")}`;

	it("sends names and keyvalues beyond Latin-1 as UTF-8", async () => {
		const fetchMock = script(new Response("stop", { status: 500 }));

		await uploadFile(withJwt, largeFile, "private", {
			metadata: { name: "動画 🎬.mp4", keyvalues: { title: "Café ☕" } },
		}).catch(() => undefined);

		const header: string = (fetchMock.mock.calls[0] as any)[1].headers[
			"Upload-Metadata"
		];
		const values = Object.fromEntries(
			header.split(",").map((pair) => {
				const [key, value] = pair.split(" ");
				return [key, decode(value)];
			}),
		);
		expect(values.filename).toBe("動画 🎬.mp4");
		expect(JSON.parse(values.keyvalues)).toEqual({ title: "Café ☕" });
	});

	describe("when the upload cannot start", () => {
		it("says why, with the HTTP status", async () => {
			script(
				new Response(
					'{"error":{"code":413,"message":"free users are limited to max 1GB uploads"}}',
					{ status: 413 },
				),
			);

			const error = await uploadFile(withJwt, largeFile, "public").catch(
				(e) => e,
			);

			expect(error).toBeInstanceOf(NetworkError);
			expect(error.message).toBe(
				"Could not start the upload (HTTP 413): free users are limited to max 1GB uploads",
			);
			expect(error.statusCode).toBe(413);
			expect(error.details.error).toContain("max 1GB");
		});

		it("leaves an HTML error page out of the message", async () => {
			script(
				new Response("<html><body>503 Service Temporarily Unavailable</body>", {
					status: 503,
				}),
			);

			await expect(uploadFile(withJwt, largeFile, "public")).rejects.toThrow(
				/^Could not start the upload \(HTTP 503\)$/,
			);
		});

		it("reports a success without an upload URL", async () => {
			script(new Response(null, { status: 201 }));

			await expect(uploadFile(withJwt, largeFile, "public")).rejects.toThrow(
				"Upload URL not provided: the server answered 201 without a Location header",
			);
		});
	});

	describe("without a JWT to look the file up", () => {
		it("returns the id and name the server reports for the registered file", async () => {
			script(
				created(),
				accepted(chunkSize),
				accepted(largeSize, {
					"Upload-Cid": "bafyfinal",
					"Upload-Metadata": registered("file-id", "動画.mp4"),
					"Upload-Content-Type": "video/mp4",
				}),
			);

			const result = await uploadFile(withoutJwt, largeFile, "private");

			expect(result).toMatchObject({
				id: "file-id",
				name: "動画.mp4",
				cid: "bafyfinal",
				size: largeSize,
				network: "private",
			});
		});

		it("returns the earlier file the server registered the upload as", async () => {
			// The server found the same content already stored, under another id and name
			script(
				created(),
				accepted(chunkSize),
				accepted(largeSize, {
					"Upload-Status": "processing",
					"Upload-Cid": "bafyfinal",
				}),
				new Response(null, {
					status: 200,
					headers: {
						"Upload-Offset": largeSize.toString(),
						"Upload-Status": "ready",
						"Upload-Cid": "bafyfinal",
						"Upload-Metadata": registered("earlier-id", "earlier.bin"),
						// Detected from this upload, not the earlier file's type
						"Upload-Content-Type": "application/octet-stream",
					},
				}),
			);

			const result = await uploadFile(withoutJwt, largeFile, "public", {
				metadata: { name: "large.bin" },
			});

			expect(result).toMatchObject({
				id: "earlier-id",
				name: "earlier.bin",
				cid: "bafyfinal",
				mime_type: "",
				network: "public",
			});
		});

		it("leaves id and name empty until the file is registered", async () => {
			// waitForCid: false returns before registration; the server only echoes the request
			script(
				created(),
				accepted(chunkSize),
				accepted(largeSize, {
					"Upload-Status": "processing",
					"Upload-Cid": "bafyearly",
					"Upload-Metadata": `filename ${encodeMetadataValue("large.bin")}`,
				}),
			);

			const result = await uploadFile(withoutJwt, largeFile, "public", {
				waitForCid: false,
			});

			expect(result).toMatchObject({
				id: "",
				name: "",
				cid: "bafyearly",
				network: "public",
			});
		});
	});
});
