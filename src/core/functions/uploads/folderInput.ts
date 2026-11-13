// Checks and normalises what a folder upload is given: its options, its folder id and the
// paths of its files.

import { ValidationError } from "../../../utils/custom-errors";
import type {
	FolderEntry,
	FolderUploadOptions,
	UploadOptions,
} from "../../types";

const DEFAULT_CONCURRENCY = 4;
const DEFAULT_RETRIES = 3;
const DEFAULT_FOLDER_NAME = "folder_from_sdk";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A file of the folder with its full path in it. `index`: its position in the files given.
export interface ResolvedEntry {
	index: number;
	path: string;
	file: File;
}

export const rejectUnsupported = (options?: UploadOptions) => {
	const unsupported = [
		options?.vectorize && "vectorize",
		options?.url && "url (signed upload URLs)",
		options?.car && "car",
		options?.streamable && "streamable",
		options?.peerAddresses && "peerAddress",
		options?.waitForCid === false && "waitForCid(false)",
	].filter(Boolean);
	if (unsupported.length > 0) {
		throw new ValidationError(
			`Folder uploads do not support: ${unsupported.join(", ")}`,
		);
	}
};

// The concurrency and retries asked for: whole numbers, at least 1 and 0. Not a finite
// number (NaN from an empty form field): the default.
export const folderLimits = (
	options?: FolderUploadOptions,
): { concurrency: number; retries: number } => {
	const finite = (value: number | undefined, fallback: number) =>
		value !== undefined && Number.isFinite(value) ? value : fallback;
	return {
		concurrency: Math.max(
			1,
			Math.floor(finite(options?.concurrency, DEFAULT_CONCURRENCY)),
		),
		retries: Math.max(0, Math.floor(finite(options?.retries, DEFAULT_RETRIES))),
	};
};

// The folder id given, which must be a UUID, else a new UUID version 7
export const resolveFolderId = (folderId?: string): string => {
	if (folderId === undefined) return uuidv7();
	if (!UUID.test(folderId)) {
		throw new ValidationError(
			`The folder id must be a UUID: got "${folderId}"`,
		);
	}
	return folderId;
};

// Files as entries with their full path in the folder: `<folder name>/<path>`. The folder
// name is `name`, else the top directory all paths share (as in an <input webkitdirectory>
// selection), else a default.
export const folderEntries = (
	files: File[] | FolderEntry[],
	name?: string,
): { folderName: string; entries: ResolvedEntry[] } => {
	if (!Array.isArray(files) || files.length === 0) {
		throw new ValidationError("A folder upload needs at least one file");
	}
	const split = files.map((item) => {
		// An entry's path may use "\\" as separator (a Windows path). A File's path never
		// does (webkitRelativePath uses "/"), so there "\\" is part of a name, which the
		// server refuses.
		const [file, path] = isFolderEntry(item)
			? [item.file, item.path.replace(/\\/g, "/")]
			: [item, item.webkitRelativePath || item.name];
		const segments = path.replace(/^(\.?\/)+/, "").split("/");
		if (segments.some((s) => s === "" || s === "." || s === "..")) {
			throw new ValidationError(`Invalid path in folder upload: "${path}"`);
		}
		return { file, segments };
	});

	const top = split[0].segments[0];
	const sharedTop = split.every(
		({ segments }) => segments.length > 1 && segments[0] === top,
	);
	const folder = name || (sharedTop ? top : DEFAULT_FOLDER_NAME);
	// One segment, checked as the input paths are
	if (/[/\\%]/.test(folder) || folder === "." || folder === "..") {
		throw new ValidationError(`Invalid folder name: "${folder}"`);
	}

	const seen = new Set<string>();
	const entries = split.map(({ file, segments }, index) => {
		const path = [folder, ...(sharedTop ? segments.slice(1) : segments)].join(
			"/",
		);
		if (seen.has(path)) {
			throw new ValidationError(
				`Two files have the same path in the folder: "${path}"`,
			);
		}
		seen.add(path);
		return { index, path, file };
	});
	return { folderName: folder, entries };
};

// Why a file can't be sent, if it can't. A path holding "%" can't be looked up after it is
// sent, so the file would be reported failed while it lands in the folder: it is refused
// up front.
export const unsendablePath = (path: string): ValidationError | undefined =>
	path.includes("%")
		? new ValidationError(
				`File paths containing "%" cannot be uploaded yet: "${path}"`,
			)
		: undefined;

const isFolderEntry = (item: File | FolderEntry): item is FolderEntry =>
	typeof (item as FolderEntry).path === "string" &&
	(item as FolderEntry).file !== undefined;

// A UUID version 7 (time-ordered)
const uuidv7 = (): string => {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	const time = Date.now();
	for (let i = 0; i < 6; i++) {
		bytes[i] = Math.floor(time / 2 ** (8 * (5 - i))) & 0xff;
	}
	bytes[6] = (bytes[6] & 0x0f) | 0x70;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
		"",
	);
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
