// A stand-in for the Blobs Node.js builds, including the ways they break past 4 GiB
// (nodejs/node#66207), without holding their bytes in memory.
//
// - A File's parts are laid out by their real lengths, but `size` adds up what each part
//   reports, and fs.openAsBlob() reports a file over 4 GiB modulo 2^32.
// - slice() maps to real positions, clamps to `size`, and aborts the process (here: throws)
//   when start or end is 2^32 or more.
// - stream() yields every real byte: a part held in memory as one piece, a part on disk in
//   64 KiB pieces.

// The byte at real position `p` of every fake file. It differs at every offset, so a test
// can tell which bytes were sent.
export const byteAt = (p: number) => p % 251;

const PERIOD = 251;
const DISK_PIECE = 64 * 1024;
export const MAX_MEMORY_PART = 96 * 1024 * 1024;
let pattern: Uint8Array<ArrayBuffer> | undefined;

// `length` bytes starting at real position `p`, as a view of one shared buffer
function bytesAt(p: number, length: number): Uint8Array<ArrayBuffer> {
	if (length > MAX_MEMORY_PART) {
		throw new Error(`test fake: a piece of ${length} bytes is too large`);
	}
	if (!pattern) {
		pattern = new Uint8Array(MAX_MEMORY_PART + PERIOD);
		for (let i = 0; i < pattern.length; i++) {
			pattern[i] = byteAt(i);
		}
	}
	return pattern.subarray(p % PERIOD, (p % PERIOD) + length);
}

export interface FakePart {
	length: number;
	// What the part reports as its size (fs.openAsBlob over 4 GiB: length modulo 2^32)
	reported?: number;
	disk?: boolean;
}

interface Segment {
	// Real position of the segment's first byte
	at: number;
	length: number;
	disk: boolean;
}

export class NodeLikeFile extends File {
	readonly sliceCalls: Array<[number, number]> = [];
	streamCalls = 0;

	private constructor(
		private readonly segments: Segment[],
		size: number,
	) {
		super([], "large.bin", { type: "application/octet-stream" });
		Object.defineProperty(this, "size", { value: size });
	}

	static of(...parts: FakePart[]): NodeLikeFile {
		let at = 0;
		let size = 0;
		const segments = parts.map((part) => {
			const segment = { at, length: part.length, disk: part.disk ?? false };
			at += part.length;
			size += part.reported ?? part.length;
			return segment;
		});
		return new NodeLikeFile(segments, size);
	}

	slice(start = 0, end = this.size): NodeLikeFile {
		this.sliceCalls.push([start, end]);
		const from = Math.min(Math.max(start, 0), this.size);
		const to = Math.max(Math.min(end, this.size), from);
		if (from > 2 ** 32 - 1 || to > 2 ** 32 - 1) {
			throw new Error(`Node aborts: slice(${from}, ${to}) past 2^32`);
		}
		// Cut [from, to) out of the segments, counted by their real lengths
		const segments: Segment[] = [];
		let position = 0;
		for (const segment of this.segments) {
			const lo = Math.max(from, position);
			const hi = Math.min(to, position + segment.length);
			if (lo < hi) {
				segments.push({
					at: segment.at + lo - position,
					length: hi - lo,
					disk: segment.disk,
				});
			}
			position += segment.length;
		}
		return new NodeLikeFile(segments, to - from);
	}

	stream(): ReadableStream<Uint8Array<ArrayBuffer>> {
		this.streamCalls++;
		const pieces = (function* (segments: Segment[]) {
			for (const segment of segments) {
				const step = segment.disk ? DISK_PIECE : segment.length;
				for (let o = 0; o < segment.length; o += step) {
					yield bytesAt(segment.at + o, Math.min(step, segment.length - o));
				}
			}
		})(this.segments);
		return new ReadableStream({
			pull(controller) {
				const next = pieces.next();
				if (next.done) {
					controller.close();
				} else {
					controller.enqueue(next.value);
				}
			},
		});
	}

	async arrayBuffer(): Promise<ArrayBuffer> {
		const bytes = new Uint8Array(this.size);
		let filled = 0;
		for (const segment of this.segments) {
			const length = Math.min(segment.length, this.size - filled);
			bytes.set(bytesAt(segment.at, length), filled);
			filled += length;
		}
		return bytes.buffer;
	}
}
