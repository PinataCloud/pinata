import {
	FileChunks,
	SLICE_LIMIT,
} from "../../src/core/functions/uploads/fileChunks";
import { ValidationError } from "../../src/utils/custom-errors";
import { NodeLikeFile, byteAt } from "./nodeLikeFile";

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;
const chunkSize = 50 * MiB + 1;

// A file held in memory as 64 MiB parts, `size` bytes long
const inMemory = (size: number) => {
	const parts = [];
	for (let o = 0; o < size; o += 64 * MiB) {
		parts.push({ length: Math.min(64 * MiB, size - o) });
	}
	return NodeLikeFile.of(...parts);
};

const first = async (body: Blob | Uint8Array) =>
	body instanceof Blob
		? new Uint8Array(await body.slice(0, 1).arrayBuffer())[0]
		: body[0];
const last = async (body: Blob | Uint8Array) => {
	const size = body instanceof Blob ? body.size : body.byteLength;
	return body instanceof Blob
		? new Uint8Array(await body.slice(size - 1, size).arrayBuffer())[0]
		: body[size - 1];
};
const sizeOf = (body: Blob | Uint8Array) =>
	body instanceof Blob ? body.size : body.byteLength;

const slicedPast = (file: NodeLikeFile) =>
	file.sliceCalls.filter(([a, b]) => a > SLICE_LIMIT || b > SLICE_LIMIT);

describe("FileChunks", () => {
	it("cuts a file over 4 GiB held in memory with slice() below 2^32, and the rest from its stream", async () => {
		const size = 4 * GiB + 30 * MiB;
		const file = inMemory(size);
		const chunks = new FileChunks(file, chunkSize);

		let offset = 0;
		let sliced = 0;
		while (offset < size) {
			const body = await chunks.at(offset);
			const length = sizeOf(body);
			expect(length).toBe(Math.min(chunkSize, size - offset));
			expect(await first(body)).toBe(byteAt(offset));
			expect(await last(body)).toBe(byteAt(offset + length - 1));
			if (body instanceof Blob) {
				expect(offset + length).toBeLessThanOrEqual(SLICE_LIMIT);
				sliced++;
			}
			offset += length;
		}
		await chunks.close();

		expect(sliced).toBe(Math.floor(SLICE_LIMIT / chunkSize));
		expect(slicedPast(file)).toEqual([]);
		expect(file.streamCalls).toBe(1);
	});

	it("slices a file of 2^32 - 1 bytes to its end", async () => {
		const file = inMemory(SLICE_LIMIT);
		const chunks = new FileChunks(file, chunkSize);

		const body = await chunks.at(SLICE_LIMIT - 100);

		expect(body).toBeInstanceOf(Blob);
		expect(sizeOf(body)).toBe(100);
		expect(file.sliceCalls).toContainEqual([SLICE_LIMIT - 100, SLICE_LIMIT]);
		expect(file.streamCalls).toBe(0);
	});

	it("reads the last chunk of a file of exactly 2^32 bytes from its stream", async () => {
		const file = inMemory(2 ** 32);
		const chunks = new FileChunks(file, chunkSize);

		const body = await chunks.at(2 ** 32 - 100);
		await chunks.close();

		expect(body).toBeInstanceOf(Uint8Array);
		expect(sizeOf(body)).toBe(100);
		expect(await last(body)).toBe(byteAt(2 ** 32 - 1));
		expect(slicedPast(file)).toEqual([]);
	});

	it("reads a file on disk over 4 GiB from its stream alone", async () => {
		const size = 4 * GiB + 10 * MiB;
		const file = NodeLikeFile.of({ length: size, disk: true });
		const chunks = new FileChunks(file, chunkSize);

		const body = await chunks.at(size - 100);
		await chunks.close();

		expect(body).toBeInstanceOf(Uint8Array);
		expect(await first(body)).toBe(byteAt(size - 100));
		// Only to look at the MiB before 2^32
		expect(file.sliceCalls).toEqual([[SLICE_LIMIT - MiB, SLICE_LIMIT]]);
	});

	it("refuses the last chunk of a file over 4 GiB whose last part holds more than it reports", async () => {
		const parts = [];
		for (let i = 0; i < 64; i++) {
			parts.push({ length: 64 * MiB });
		}
		parts.push({ length: 30 * MiB, reported: 10 * MiB, disk: true });
		const file = NodeLikeFile.of(...parts);
		const chunks = new FileChunks(file, chunkSize);

		// The bytes below 2^32 are cut with slice()
		expect(await chunks.at(0)).toBeInstanceOf(Blob);
		await expect(chunks.at(file.size - 100)).rejects.toThrow(ValidationError);
		await chunks.close();
		expect(slicedPast(file)).toEqual([]);
	});

	it("keeps resending the rest of the chunk that holds an offset", async () => {
		const file = inMemory(120 * MiB);
		const chunks = new FileChunks(file, chunkSize);

		await chunks.at(0);
		const rest = await chunks.at(1000);

		expect(sizeOf(rest)).toBe(chunkSize - 1000);
		expect(await first(rest)).toBe(byteAt(1000));
		expect(file.sliceCalls).toContainEqual([1000, chunkSize]);
	});
});
