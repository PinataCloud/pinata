#!/usr/bin/env node
// CID parity check for folder uploads, against Pinata (live). The same fixture tree is
// uploaded three ways and every CID is compared, file by file and folder by folder:
//   - kubo: `ipfs add -r --only-hash --cid-version 1 --raw-leaves` (the reference)
//   - single: each file uploaded on its own (upload.public.file)
//   - folder: the folder uploaded file by file (upload.public.folder): the CIDs the SDK reports
//     and the CIDs the gateway serves along each path (X-Ipfs-Roots: root, subfolders, file)
//   - legacy: the folder in one request (upload.public.fileArray), as served by the gateway
// Exits 1 on any mismatch. Needs a built SDK (`npm run build`) and kubo (`ipfs`, or IPFS_BIN).
//
//   PINATA_JWT=… node scripts/verify-folder-cids.mjs [--gateway https://gateway.pinata.cloud] [--out report.json]

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PinataSDK } from "../dist/index.mjs";

const arg = (name, fallback) => {
	const i = process.argv.indexOf(`--${name}`);
	return i > 0 ? process.argv[i + 1] : fallback;
};
const jwt = process.env.PINATA_JWT;
if (!jwt) {
	console.error("PINATA_JWT is required");
	process.exit(2);
}
const gateway = arg("gateway", "https://gateway.pinata.cloud");
const ipfs = process.env.IPFS_BIN || "ipfs";
// --reuse report.json: check the uploads of an earlier run again (same fixture), without
// uploading anything
const reused = arg("reuse")
	? JSON.parse(readFileSync(arg("reuse"), "utf8"))
	: undefined;
const stamp = reused
	? reused.root.replace("cid-parity-", "")
	: Date.now().toString(36);
const root = `cid-parity-${stamp}`;

// Sizes around the 256 KiB chunk and the 174-link node boundaries, an empty file, the same
// content twice, nested and unicode paths
const CHUNK = 262144;
const fixture = [
	["empty.txt", 0],
	["one-byte.txt", 1],
	["chunk-minus-1.bin", CHUNK - 1],
	["chunk.bin", CHUNK],
	["chunk-plus-1.bin", CHUNK + 1],
	["docs/notes.md", 1500],
	["docs/twin-a.txt", 4096, "twin"],
	["docs/twin-b.txt", 4096, "twin"],
	["docs/deep/er/leaf.json", 777],
	["media/one-mib-plus-1.bin", 1048577],
	["media/174-chunks.bin", CHUNK * 174 + 3],
	["ünï/日本語 file.txt", 2048],
].map(([path, size, seed]) => ({ path, size, seed: seed ?? path }));

// Deterministic bytes per seed, so twins have the same content and reruns differ by stamp
const bytes = (seed, size) => {
	const out = Buffer.alloc(size);
	let block = Buffer.alloc(0);
	for (let offset = 0, n = 0; offset < size; offset += block.length, n++) {
		block = createHash("sha256").update(`${stamp}:${seed}:${n}`).digest();
		block.copy(out, offset);
	}
	return out;
};

// kubo reference: every file and every folder
const dir = mkdtempSync(join(tmpdir(), "cid-parity-"));
const ipfsEnv = {
	...process.env,
	IPFS_PATH: process.env.IPFS_PATH || join(dir, ".ipfs"),
};
if (!process.env.IPFS_PATH)
	execFileSync(ipfs, ["init", "--profile", "test"], {
		env: ipfsEnv,
		stdio: "ignore",
	});
for (const file of fixture) {
	file.data = bytes(file.seed, file.size);
	mkdirSync(dirname(join(dir, root, file.path)), { recursive: true });
	writeFileSync(join(dir, root, file.path), file.data);
}
const kubo = new Map(
	execFileSync(
		ipfs,
		[
			"add",
			"-r",
			"--progress=false",
			"--only-hash",
			"--cid-version",
			"1",
			"--raw-leaves",
			"-H",
			join(dir, root),
		],
		{ env: ipfsEnv, cwd: dir, stdio: ["ignore", "pipe", "ignore"] },
	)
		.toString()
		.trim()
		.split("\n")
		.map((line) => {
			const [, cid, ...path] = line.split(" ");
			return [path.join(" ").replace(/^.*?cid-parity-[^/]+/, root), cid];
		}),
);

const pinata = new PinataSDK({ pinataJwt: jwt });
const asFile = (file, relative) => {
	const f = new File([file.data], file.path.split("/").pop());
	if (relative)
		Object.defineProperty(f, "webkitRelativePath", { value: relative });
	return f;
};
const settle = (promise) =>
	promise.then(
		(value) => ({ value }),
		(error) => ({ error: error?.message ?? String(error) }),
	);

// The CID the gateway resolves `path` under `cid` to, file or folder: the ETag of its raw block
// (trustless gateway `?format=raw`). Retried while the gateway rate-limits.
const resolve = async (cid, path) => {
	const encoded = path
		? `/${path.split("/").map(encodeURIComponent).join("/")}`
		: "";
	for (let attempt = 1; ; attempt++) {
		const res = await fetch(`${gateway}/ipfs/${cid}${encoded}?format=raw`, {
			method: "HEAD",
		});
		const etag = res.headers.get("etag");
		if (res.ok && etag)
			return etag.replace(/^(W\/)?"|"$/g, "").replace(/\.raw$/, "");
		if (attempt >= 10) return `HTTP ${res.status}`;
		const wait = Number(res.headers.get("retry-after")) || 2 * attempt;
		await new Promise((r) => setTimeout(r, Math.min(wait, 60) * 1000));
	}
};

console.log(
	`fixture ${root}: ${fixture.length} files; ${reused ? "re-checking the uploads of" : "uploading single, folder and legacy for"} ${arg("reuse") ?? "this run"}…`,
);
const upload = async () => {
	const single = await Promise.all(
		fixture.map((file) =>
			settle(
				pinata.upload.public.file(asFile(file)).name(`${root}-${file.path}`),
			),
		),
	);
	const folder = await settle(
		pinata.upload.public
			.folder(
				fixture.map((file) => ({
					path: `${root}/${file.path}`,
					file: asFile(file),
				})),
			)
			.name(root),
	);
	const legacy = await settle(
		pinata.upload.public
			.fileArray(
				fixture
					.filter((f) => f.size > 0)
					.map((file) => asFile(file, `${root}-legacy/${file.path}`)),
			)
			.name(`${root}-legacy`),
	);

	return { single, folder, legacy };
};
const { single, folder, legacy } = reused
	? {
			single: reused.rows
				.filter((row) => row.size !== "")
				.map((row) =>
					row.single?.startsWith("baf")
						? { value: { cid: row.single } }
						: { error: row.single.replace(/^(n\/a|MISSING): /, "") },
				),
			folder:
				typeof reused.folder === "string"
					? { error: reused.folder }
					: { value: reused.folder },
			legacy:
				typeof reused.legacy === "string"
					? { error: reused.legacy }
					: { value: reused.legacy },
		}
	: await upload();

const rows = [];
const mismatches = [];
// Every value that is not "n/a" must equal kubo's; a missing one is a mismatch too
const check = (row) => {
	const bad = Object.entries(row).filter(
		([key, value]) =>
			!["path", "size", "kubo"].includes(key) &&
			!String(value ?? "").startsWith("n/a") &&
			value !== row.kubo,
	);
	row.match =
		bad.length === 0 ? "yes" : `NO (${bad.map(([key]) => key).join(", ")})`;
	if (bad.length) mismatches.push(row);
	rows.push(row);
};

const folderCid = folder.value?.cid;
const legacyCid = legacy.value?.cid;
for (const [i, file] of fixture.entries()) {
	const served = folderCid ? await resolve(folderCid, file.path) : undefined;
	const servedLegacy =
		legacyCid && file.size > 0
			? await resolve(legacyCid, file.path)
			: undefined;
	check({
		path: file.path,
		size: String(file.size),
		kubo: kubo.get(`${root}/${file.path}`),
		// The single-file API refuses empty files
		single:
			single[i].value?.cid ??
			`${file.size === 0 ? "n/a" : "MISSING"}: ${single[i].error}`,
		folderSdk:
			folder.value?.files.find((f) => f.index === i)?.cid ??
			`MISSING: ${folder.error}`,
		folderGateway: served,
		legacyGateway: file.size > 0 ? servedLegacy : "n/a: not sent (0 bytes)",
	});
}
// Folders: the root, then every subfolder as the gateway resolves it
const subfolders = [
	...new Set(
		fixture.flatMap((f) =>
			f.path
				.split("/")
				.slice(0, -1)
				.map((_, j, parts) => parts.slice(0, j + 1).join("/")),
		),
	),
];
check({
	path: `${root}/`,
	size: "",
	kubo: kubo.get(root),
	single: "n/a",
	folderSdk: folderCid ?? `MISSING: ${folder.error}`,
	folderGateway: folderCid ? await resolve(folderCid, "") : "MISSING",
	legacyGateway: "n/a: holds no empty file (next row)",
});
for (const sub of subfolders) {
	check({
		path: `${sub}/`,
		size: "",
		kubo: kubo.get(`${root}/${sub}`),
		single: "n/a",
		folderSdk: "n/a",
		folderGateway: folderCid ? await resolve(folderCid, sub) : "MISSING",
		legacyGateway: legacyCid ? await resolve(legacyCid, sub) : "MISSING",
	});
}
// The legacy upload refuses empty files, so its root is compared with kubo of the tree without
// the empty file
if (legacyCid) {
	for (const file of fixture.filter((f) => f.size > 0)) {
		mkdirSync(dirname(join(dir, "legacy", root, file.path)), {
			recursive: true,
		});
		writeFileSync(join(dir, "legacy", root, file.path), file.data);
	}
	const reference = execFileSync(
		ipfs,
		[
			"add",
			"-r",
			"-Q",
			"--progress=false",
			"--only-hash",
			"--cid-version",
			"1",
			"--raw-leaves",
			"-H",
			join(dir, "legacy", root),
		],
		{ env: ipfsEnv, stdio: ["ignore", "pipe", "ignore"] },
	)
		.toString()
		.trim();
	check({
		path: `${root}/ (no empty file)`,
		size: "",
		kubo: reference,
		single: "n/a",
		folderSdk: "n/a",
		folderGateway: "n/a",
		legacyGateway: legacyCid ? await resolve(legacyCid, "") : "MISSING",
	});
}

const keys = [
	"path",
	"size",
	"kubo",
	"single",
	"folderSdk",
	"folderGateway",
	"legacyGateway",
	"match",
];
const short = (value) =>
	value && value.length > 20 && value.startsWith("baf")
		? `${value.slice(0, 10)}…${value.slice(-6)}`
		: (value ?? "");
console.log(keys.join(" | "));
for (const row of rows)
	console.log(keys.map((key) => short(String(row[key] ?? ""))).join(" | "));
console.log(
	`\nfolder: ${folderCid ?? folder.error}\nlegacy: ${legacyCid ?? legacy.error}\nkubo:   ${kubo.get(root)}`,
);
const out = arg("out");
if (out)
	writeFileSync(
		out,
		JSON.stringify(
			{
				root,
				folder: folder.value ?? folder.error,
				legacy: legacy.value ?? legacy.error,
				rows,
			},
			null,
			2,
		),
	);
console.log(
	mismatches.length
		? `\n${mismatches.length} MISMATCH(ES)`
		: "\nall CIDs match",
);
process.exit(mismatches.length ? 1 : 0);
