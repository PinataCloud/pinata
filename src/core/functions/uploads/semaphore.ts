// Runs at most `limit` tasks at a time, in the order they ask.
export class Semaphore {
	private active = 0;
	private waiting: (() => void)[] = [];

	constructor(private readonly limit: number) {}

	async run<T>(task: () => Promise<T>): Promise<T> {
		if (this.active >= this.limit) {
			await new Promise<void>((resolve) => this.waiting.push(resolve));
		} else {
			this.active++;
		}
		try {
			return await task();
		} finally {
			const next = this.waiting.shift();
			if (next) next();
			else this.active--;
		}
	}
}
