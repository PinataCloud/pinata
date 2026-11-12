import { ValidationError } from "../../../utils/custom-errors";
import { StreamChunks } from "./streamChunks";

// Node's Blob.slice() aborts the process when start or end is 2^32 or more, an end of
// exactly 2^32 included (nodejs/node#66207).
export const SLICE_LIMIT = 2 ** 32 - 1;
const PROBE_SIZE = 1024 * 1024;

// Whether the MiB before `end` comes out of the file's stream in one piece. Node's stream
// hands over data held in memory (a Buffer, a string, a File parsed from FormData) a whole
// part at a time, and reads a file opened with fs.openAsBlob() in small pieces.
async function inMemoryBefore(file: Blob, end: number): Promise<boolean> {
	const probe = Math.min(end, PROBE_SIZE);
	const reader = file
		.slice(end - probe, end)
		.stream()
		.getReader();
	try {
		const { value } = await reader.read();
		return value?.byteLength === probe;
	} finally {
		await reader.cancel().catch(() => undefined);
	}
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
// (whose size is off by a multiple of 2^32): the stream then reads that part in small
// pieces, and its real bytes cover the end of the reported size, so the probe sees them
// and the file goes through StreamChunks.
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
		this.sliced ??= await inMemoryBefore(
			this.file,
			Math.min(this.file.size, SLICE_LIMIT),
		);
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
