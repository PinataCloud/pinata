// Folder upload paths the review of #105 found untested: builder keyvalues over options,
// the folder CID version, the file count check.
import type { PinataConfig } from "../../src";
import { uploadFolder } from "../../src/core/functions";
import { PublicUpload } from "../../src/core/classes/uploads/PublicUpload";

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

describe("folder uploads, options and checks", () => {
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

	it("lets .keyvalues() win over the keyvalues given in the options", async () => {
		const sent: Record<string, string>[] = [];
		global.fetch = jest.fn(async (url: string, init: RequestInit) => {
			if (init.method === "PUT") return synced(1);
			sent.push(
				decodeMetadata(
					(init.headers as Record<string, string>)["Upload-Metadata"],
				),
			);
			return registered(url, init);
		}) as unknown as typeof fetch;

		await new PublicUpload(config)
			.folder([{ path: "d/a.txt", file: file("a") }], {
				metadata: { name: "kept", keyvalues: { from: "options" } },
			})
			.keyvalues({ from: "builder" });

		expect(sent[0].filename).toBe("kept/a.txt");
		expect(JSON.parse(sent[0].keyvalues)).toEqual({ from: "builder" });
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
			return registered(url, init);
		}) as unknown as typeof fetch;

		await new PublicUpload(config)
			.folder([
				{ path: "d/a.txt", file: file("a") },
				{ path: "d/b.txt", file: file("bb") },
			])
			.cidVersion("v0");

		expect(versions).toEqual(["v0", "v0"]);
		for (const url of urls) {
			expect(new URL(url).searchParams.get("X-Upload-Option-Cid-Version")).toBe(
				"v0",
			);
		}
	});

	it("rejects when the synced folder holds fewer files than were uploaded", async () => {
		global.fetch = jest.fn(async (url: string, init: RequestInit) =>
			init.method === "PUT" ? synced(1) : registered(url, init),
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
