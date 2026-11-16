import { ValidationError } from "../../../utils/custom-errors";

// What a file whose stream holds more bytes than its size fails with
export const largerThanSize = (size: number) =>
	new ValidationError(
		`The file is larger than its reported size of ${size} bytes: it has more bytes after that, ` +
			"so uploading it would store a truncated file. Node's fs.openAsBlob() reports the size of files " +
			"over 4 GiB modulo 2^32 (nodejs/node#66207); pass a File whose size matches its contents.",
	);

// Cuts a file into the chunks of a resumable upload by reading `file.stream()` once,
// front to back, instead of calling `file.slice()`.
//
// Node's Blob is broken past 2^32 bytes in every released line (nodejs/node#66207):
// `fs.openAsBlob()` reports `size` modulo 2^32 and slices past that wrapped size come
// back empty, and on a correctly sized Blob `slice()` with an end above 2^32 aborts the
// process. `stream()` returns every byte in both cases, so this reads the stream and
// checks it against `size`: the upload must never complete with fewer bytes than the
// file holds.
//
// Holds one chunk in memory, so a failed PATCH can resend it. Going back before the
// current chunk (a server that lost bytes it had confirmed) restarts the stream.
export class StreamChunks {
	private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
	// Bytes read from the stream but not yet part of a chunk
	private pending: Uint8Array = new Uint8Array(0);
	// Stream position of the first byte of `pending`
	private position = 0;
	// Copied out of the stream into its own ArrayBuffer, so fetch accepts it as a body
	private chunk: Uint8Array<ArrayBuffer> = new Uint8Array(0);
	private chunkStart = 0;

	constructor(
		private readonly file: Blob,
		private readonly chunkSize: number,
	) {}

	// The bytes to send at `offset`: the rest of the chunk that holds it.
	async at(offset: number): Promise<Uint8Array<ArrayBuffer>> {
		const chunkEnd = this.chunkStart + this.chunk.byteLength;
		if (offset < this.chunkStart || offset >= chunkEnd || !this.reader) {
			await this.load(offset);
		}
		return this.chunk.subarray(offset - this.chunkStart);
	}

	// Releases the stream. Safe to call more than once.
	async close(): Promise<void> {
		const reader = this.reader;
		this.reader = null;
		this.pending = new Uint8Array(0);
		this.chunk = new Uint8Array(0);
		if (reader) {
			await reader.cancel().catch(() => undefined);
		}
	}

	// Reads the chunk that starts at `offset`.
	private async load(offset: number): Promise<void> {
		if (!this.reader || offset < this.position) {
			await this.close();
			this.reader = this.file.stream().getReader();
			this.position = 0;
		}
		// Drop the old chunk first, so at most one is held at a time
		this.chunk = new Uint8Array(0);
		await this.skip(offset - this.position);

		const length = Math.min(this.chunkSize, this.file.size - offset);
		const chunk = new Uint8Array(length);
		let filled = 0;
		while (filled < length) {
			const bytes = await this.take(length - filled);
			if (!bytes) {
				throw new ValidationError(
					`The file is smaller than its reported size: its stream ended after ${offset + filled} of ${this.file.size} bytes`,
				);
			}
			chunk.set(bytes, filled);
			filled += bytes.byteLength;
		}

		// The PATCH with this chunk completes the upload: make sure the file ends here.
		if (offset + length === this.file.size && (await this.hasMore())) {
			throw largerThanSize(this.file.size);
		}

		this.chunk = chunk;
		this.chunkStart = offset;
	}

	// Discards the next `count` bytes of the stream.
	private async skip(count: number): Promise<void> {
		while (count > 0) {
			const bytes = await this.take(count);
			if (!bytes) {
				throw new ValidationError(
					`The file is smaller than its reported size: its stream ended after ${this.position} of ${this.file.size} bytes`,
				);
			}
			count -= bytes.byteLength;
		}
	}

	// Returns up to `max` bytes from the stream, or null once it has ended.
	private async take(max: number): Promise<Uint8Array | null> {
		if (this.pending.byteLength === 0) {
			const next = await this.next();
			if (!next) {
				return null;
			}
			this.pending = next;
		}
		const bytes = this.pending.subarray(0, max);
		this.pending = this.pending.subarray(bytes.byteLength);
		this.position += bytes.byteLength;
		return bytes;
	}

	private async hasMore(): Promise<boolean> {
		if (this.pending.byteLength > 0) {
			return true;
		}
		const next = await this.next();
		if (!next) {
			return false;
		}
		this.pending = next;
		return true;
	}

	// The next non-empty piece of the stream, or null once it has ended.
	private async next(): Promise<Uint8Array | null> {
		if (!this.reader) {
			return null;
		}
		for (;;) {
			const { done, value } = await this.reader.read();
			if (done) {
				return null;
			}
			if (value && value.byteLength > 0) {
				return value;
			}
		}
	}
}
