// Pauses between attempts of an upload.

// The longest wait a Retry-After header is followed for
export const RETRY_AFTER_MAX_MS = 5 * 60 * 1000;

// How long a refusing server asks the client to wait (Retry-After: seconds or an HTTP
// date), at most RETRY_AFTER_MAX_MS. Undefined without a valid header.
export const parseRetryAfter = (headers: Headers): number | undefined => {
	const value = headers.get("retry-after")?.trim();
	if (!value) return undefined;
	const ms = /^\d+$/.test(value)
		? Number(value) * 1000
		: Date.parse(value) - Date.now();
	return Number.isFinite(ms)
		? Math.min(Math.max(ms, 0), RETRY_AFTER_MAX_MS)
		: undefined;
};

// Resolves after `ms`, or as soon as `signal` aborts. (Promise executors rather than
// Promise.withResolvers: the SDK runs on Node versions without it.)
export const sleep = (ms: number, signal?: AbortSignal) =>
	new Promise<void>((resolve) => {
		if (signal?.aborted) return resolve();
		// Declared first: a timer may fire synchronously (fake timers)
		let timer: ReturnType<typeof setTimeout> | undefined;
		const done = () => {
			clearTimeout(timer);
			signal?.removeEventListener("abort", done);
			resolve();
		};
		signal?.addEventListener("abort", done, { once: true });
		timer = setTimeout(done, ms);
	});

type Scope = Partial<EventTarget> & { navigator?: { onLine?: boolean } };

// True in a browser that knows it is offline (navigator.onLine is false) and can say when
// it is back (an "online" event)
export const isOffline = (): boolean => {
	const scope = globalThis as unknown as Scope;
	return (
		scope.navigator?.onLine === false &&
		typeof scope.addEventListener === "function" &&
		typeof scope.removeEventListener === "function"
	);
};

// While offline (isOffline), waits until the browser is back online or `signal` aborts,
// and resolves true. Resolves false at once otherwise: a request that failed then is
// worth an attempt of its own.
export const untilOnline = (signal?: AbortSignal): Promise<boolean> => {
	const scope = globalThis as unknown as Scope;
	if (!isOffline() || signal?.aborted) {
		return Promise.resolve(false);
	}
	return new Promise<boolean>((resolve) => {
		const done = () => {
			scope.removeEventListener?.("online", done);
			signal?.removeEventListener("abort", done);
			resolve(true);
		};
		scope.addEventListener?.("online", done);
		signal?.addEventListener("abort", done, { once: true });
	});
};
