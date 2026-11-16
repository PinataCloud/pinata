import { ValidationError } from "../../../utils/custom-errors";
import { StreamChunks, largerThanSize } from "./streamChunks";

// Node's Blob.slice() aborts the process when start or end is 2^32 or more, an end of
// exactly 2^32 included (nodejs/node#66207).
export const SLICE_LIMIT = 2 ** 32 - 1;
const PROBE_SIZE = 1024 * 1024;
// The pieces Node's stream reads a file opened with fs.openAsBlob() in
const DISK_PIECE = 64 * 1024;
// At most this many pieces in the probe: the parts a memory-backed file ends with
const MEMORY_PIECES = 4;

// Whether the MiB before `end` is held in memory. Node's stream hands over data held in
// memory (a Buffer, a string, a File parsed from FormData) a whole part at a time, so the
// probe arrives in as many pieces as there are parts in it, and reads a file opened with
// fs.openAsBlob() in 64 KiB pieces. A File built from a large Buffer and a small one (or a
// few) is held in memory too: its probe holds the end of each. Only memory is at stake:
// bytes past the size are found by holdsMore, whichever way the file is cut.
async function inMemoryBefore(file: Blob, end: number): Promise<boolean> {
	const probe = Math.min(end, PROBE_SIZE);
	const reader = file
		.slice(end - probe, end)
		.stream()
		.getReader();
	try {
		let pieces = 0;
		for (;;) {
			const { done, value } = await reader.read();
			if (done) return true;
			if (!value?.byteLength) continue;
			if (++pieces > MEMORY_PIECES || value.byteLength === DISK_PIECE) {
				return false;
			}
		}
	} finally {
		await reader.cancel().catch(() => undefined);
	}
}

// Whether `file` holds bytes past its size, which slice() never reads. Node maps the
// offsets of a slice through the real bytes of a part whose size it reports too small, so
// the byte at `size` of the file followed by a marker is the file's own, not the marker,
// when it holds more. Two markers: a byte of the file can't equal both. Reads 2 bytes.
// False when it can't tell (a Blob that doesn't hold the file's bytes as its own), and
// outside Node: only Node misreports sizes, and Bun copies a Blob held in memory to join it.
export async function holdsMore(file: Blob): Promise<boolean> {
	const versions = (
		globalThis as { process?: { versions?: Record<string, string> } }
	).process?.versions;
	if (!versions?.node || versions.bun || "Deno" in globalThis) return false;
	if (!(file instanceof Blob)) return false;
	for (const marker of [0x00, 0xff]) {
		const bytes = new Uint8Array(
			await new Blob([file, new Uint8Array([marker])])
				.slice(file.size, file.size + 1)
				.arrayBuffer(),
		);
		if (bytes.length !== 1) return false;
		if (bytes[0] !== marker) return true;
	}
	return false;
}

// Cuts a file into the chunks of a resumable upload.
//
// StreamChunks reads every file correctly, but Node's stream copies each in-memory part
// whole, so a File built from one large Buffer would be held twice for the whole upload.
// slice() does not copy, so a file held in memory is cut with slice() as far as slice()
// can reach. Everything else, and every chunk past 2^32, comes from StreamChunks, which
// refuses to complete an upload whose stream holds more bytes than the file's size.
//
// slice() never reads past `size`, so it cannot see that a file holds more. A file can
// only report too small a size when it, or one of its parts, comes from fs.openAsBlob()
// (whose size is off by a multiple of 2^32). When that part covers the end of the reported
// size, the probe reads it in pieces of 64 KiB at most and the file goes through
// StreamChunks. A part that does not (a File of a Buffer followed by such a part, which
// reports 0 bytes, say) is out of reach of the probe: every file below SLICE_LIMIT is
// checked for bytes past its size first (holdsMore), which reads 2 bytes, not the stream.
export class FileChunks {
	private stream: StreamChunks | null = null;
	private sliced: boolean | undefined;
	// The chunk being cut with slice(): [start, end)
	private start = 0;
	private end = 0;

	constructor(
		private readonly file: Blob,
		private readonly chunkSize: number,
	) {}

	// The body to send at `offset`: the rest of the chunk that holds it.
	async at(offset: number): Promise<Blob | Uint8Array<ArrayBuffer>> {
		if (this.sliced === undefined) {
			// Bytes past the size fail the upload before any is sent. Past SLICE_LIMIT,
			// StreamChunks finds them at the end of the stream.
			if (this.file.size < SLICE_LIMIT && (await holdsMore(this.file))) {
				throw largerThanSize(this.file.size);
			}
			this.sliced = await inMemoryBefore(
				this.file,
				Math.min(this.file.size, SLICE_LIMIT),
			);
		}
		if (this.sliced) {
			if (offset < this.start || offset >= this.end) {
				this.start = offset;
				this.end = Math.min(offset + this.chunkSize, this.file.size);
			}
			if (this.end <= SLICE_LIMIT) {
				const body = this.file.slice(offset, this.end);
				if (body.size !== this.end - offset) {
					throw new ValidationError(
						`The file is smaller than its reported size: bytes ${offset}-${this.end} hold only ${body.size}`,
					);
				}
				return body;
			}
		}
		this.stream ??= new StreamChunks(this.file, this.chunkSize);
		return this.stream.at(offset);
	}

	// Releases the stream, if one was opened. Safe to call more than once.
	async close(): Promise<void> {
		await this.stream?.close();
	}
}
