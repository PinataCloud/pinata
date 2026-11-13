// When a request of an upload is sent again, and the pauses between attempts.

import { PinataError } from "../../../utils/custom-errors";

// The longest wait a Retry-After header is followed for
export const RETRY_AFTER_MAX_MS = 5 * 60 * 1000;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 10 * 1000;
// Spreads the retries of files that failed together
const BACKOFF_JITTER_MS = 500;
// 4xx refusals that sending again can change: a timeout, a conflict, a lock, too early and
// rate limiting
const RETRYABLE_CLIENT_ERRORS = [408, 409, 423, 425, 429];
// What a folder file is sent again after (see FolderUploadOptions.retries): no answer, a
// timeout, a conflict with an upload of the same path still finishing, too early, rate
// limiting and server errors
const TRANSIENT_STATUSES = [0, 408, 409, 425, 429];

// A refusal that sending the same request again cannot change
export const isFinalRefusal = (status: number): boolean =>
	status >= 400 && status < 500 && !RETRYABLE_CLIENT_ERRORS.includes(status);

// Worth sending a folder file, or the folder's sync, again
export const isTransient = (error: Error): boolean => {
	if (!(error instanceof PinataError)) return true; // fetch itself failed
	const status = error.statusCode;
	if (status === undefined) return false;
	return TRANSIENT_STATUSES.includes(status) || status >= 500;
};

// The pause before retry `attempt` (1 for the first): 1 s, doubling up to 10 s
export const backoff = (attempt: number): number =>
	Math.min(BACKOFF_BASE_MS * 2 ** (attempt - 1), BACKOFF_MAX_MS);

// The pause before retry `attempt` of a folder file or sync: the backoff with some jitter,
// or the wait the server asked for (Retry-After) if longer
export const retryDelay = (attempt: number, error: Error): number => {
	const asked =
		error instanceof PinataError
			? error.details?.metadata?.retryAfterMs
			: undefined;
	return Math.max(
		backoff(attempt) + Math.floor(Math.random() * BACKOFF_JITTER_MS),
		typeof asked === "number" ? asked : 0,
	);
};

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
