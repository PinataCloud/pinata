import type { PinataConfig, UploadOptions } from "../../src";
import { PrivateUpload } from "../../src/core/classes/uploads/PrivateUpload";
import { PublicUpload } from "../../src/core/classes/uploads/PublicUpload";
import { decodeMetadata } from "./uploadMetadata";

const config: PinataConfig = {
	pinataJwt: "test-jwt",
	uploadUrl: "https://uploads.test/v3",
};

describe("UploadBuilder", () => {
	const originalFetch = global.fetch;
	afterEach(() => {
		global.fetch = originalFetch;
	});

	// A folder server that registers each file at once and records its Upload-Metadata
	const folderServer = () => {
		const sent: Record<string, string>[] = [];
		global.fetch = jest.fn(async (url: string, init: RequestInit) => {
			const headers = init.headers as Record<string, string>;
			if (init.method === "PUT") {
				return new Response(
					JSON.stringify({
						data: {
							id: "f",
							name: sent[0]?.filename.split("/")[0],
							cid: "bafyfolder",
							size: 1,
							number_of_files: sent.length,
						},
					}),
					{ status: 200 },
				);
			}
			const metadata = decodeMetadata(headers["Upload-Metadata"]);
			sent.push(metadata);
			return new Response(null, {
				status: 201,
				headers: {
					Location: `${url}/${encodeURIComponent(metadata.filename)}`,
					"Upload-Offset": headers["Upload-Length"],
					"Upload-Cid": "bafyfile",
				},
			});
		}) as unknown as typeof fetch;
		return sent;
	};
	const entries = () => [
		{ path: "top/a.txt", file: new File(["a"], "a.txt") },
		{ path: "top/sub/b.txt", file: new File(["bb"], "b.txt") },
	];

	it("keeps the name and keyvalues given in a folder upload's options", async () => {
		const sent = folderServer();

		const result = await new PrivateUpload(config).folder(entries(), {
			metadata: { name: "named", keyvalues: { team: "docs" } },
			groupId: "group-1",
		});

		expect(sent.map((m) => m.filename)).toEqual([
			"named/a.txt",
			"named/sub/b.txt",
		]);
		for (const metadata of sent) {
			expect(JSON.parse(metadata.keyvalues)).toEqual({ team: "docs" });
			expect(metadata.group_id).toBe("group-1");
		}
		expect(result.name).toBe("named");
		expect(result.keyvalues).toEqual({ team: "docs" });
	});

	it("keeps the name and keyvalues given in a file upload's options", async () => {
		let body: FormData | undefined;
		global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
			body = init.body as FormData;
			return new Response(JSON.stringify({ data: { id: "f", cid: "bafy" } }), {
				status: 200,
			});
		}) as unknown as typeof fetch;

		await new PublicUpload(config).file(new File(["x"], "x.txt"), {
			metadata: { name: "named.txt", keyvalues: { team: "docs" } },
		});

		expect(body?.get("name")).toBe("named.txt");
		expect(JSON.parse(body?.get("keyvalues") as string)).toEqual({
			team: "docs",
		});
	});

	it("lets a builder method win only for the field it sets, leaving the options as given", async () => {
		const sent = folderServer();
		const options: UploadOptions = {
			metadata: { name: "from-options", keyvalues: { team: "docs" } },
		};

		await new PublicUpload(config).folder(entries(), options).name("built");

		expect(sent.map((m) => m.filename)).toEqual([
			"built/a.txt",
			"built/sub/b.txt",
		]);
		expect(JSON.parse(sent[0].keyvalues)).toEqual({ team: "docs" });
		expect(options).toEqual({
			metadata: { name: "from-options", keyvalues: { team: "docs" } },
		});
	});

	it("sends no name with a CID pinned without one, and the name given otherwise", async () => {
		const bodies: Record<string, unknown>[] = [];
		global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
			bodies.push(JSON.parse(init.body as string));
			return new Response(JSON.stringify({ data: { id: "1" } }), {
				status: 200,
			});
		}) as unknown as typeof fetch;

		await new PublicUpload(config).cid("bafyabc");
		await new PublicUpload(config).cid("bafyabc").name("given");

		expect(bodies[0]).not.toHaveProperty("name");
		expect(bodies[1].name).toBe("given");
	});
});
