// The folder of a folder upload on the server: whether it exists, and the final sync, which
// computes its CID.

import type { PinataError } from "../../../utils/custom-errors";
import { MAX_RENEWALS } from "./folderAuth";
import {
	isRateLimited,
	isTransient,
	parseRetryAfter,
	retryDelay,
	sleep,
	untilOnline,
} from "./retry";
import { type RequestHeaders, resolveHeaders } from "./tusStatus";
import { cancelled, refused, unreachable } from "./uploadErrors";

// How long the sync is sent again while the server is rate limited, in all: the server may
// be slow to finish a folder under load, but it gets there
export const SYNC_RATE_LIMIT_BUDGET_MS = 5 * 60 * 1000;
// The pauses while rate limited without Retry-After: 1 s, doubling up to 30 s, plus jitter
const SYNC_BACKOFF_BASE_MS = 1000;
const SYNC_BACKOFF_MAX_MS = 30 * 1000;
const SYNC_BACKOFF_JITTER_MS = 500;

export interface SyncedFolder {
	id: string;
	name: string;
	cid: string;
	size: number;
	number_of_files: number;
	network?: string;
	mime_type?: string;
	created_at?: string;
	/** The folder's content was already uploaded: this is that earlier folder */
	is_duplicate?: boolean;
}

// Whether the folder `folderId` exists: its file record answers 200, or 404 when there is
// none. Undefined when that can't be told: no answer, any other status, or a cancel.
export const folderExists = async (
	apiUrl: string,
	network: "public" | "private",
	folderId: string,
	headers: Record<string, string>,
	signal?: AbortSignal,
): Promise<boolean | undefined> => {
	try {
		const res = await fetch(`${apiUrl}/files/${network}/${folderId}`, {
			method: "GET",
			headers,
			signal,
		});
		await res.body?.cancel().catch(() => undefined);
		if (res.status === 200) return true;
		return res.status === 404 ? false : undefined;
	} catch {
		return undefined;
	}
};

// Computes the folder's CID from every registered file and says how many files it holds.
// `renew`, after a refusal: true if another JWT is now in use (see FolderCredentials).
// While the server is rate limited, it is sent again for up to `rateLimitBudgetMs` in all,
// as long as Retry-After asks or on a backoff, without counting against `retries`.
export const syncFolder = async (
	endpoint: string,
	folderId: string,
	headers: RequestHeaders,
	retries: number,
	signal?: AbortSignal,
	renew?: (error: Error) => Promise<boolean>,
	rateLimitBudgetMs = SYNC_RATE_LIMIT_BUDGET_MS,
): Promise<SyncedFolder> => {
	const requestUrl = `${endpoint}/buckets/${folderId}/sync`;
	const action = "Could not finish the folder";
	// When the waits while rate limited end, from the first of them
	let rateLimitedUntil: number | undefined;
	for (let spent = 0, renewals = 0, waits = 0; ; ) {
		let error: PinataError;
		try {
			const res = await fetch(requestUrl, {
				method: "PUT",
				headers: resolveHeaders(headers),
				signal,
			});
			if (res.ok) {
				const body = await res.json();
				return body.data as SyncedFolder;
			}
			error = refused(action, res.status, await res.text().catch(() => ""), {
				requestUrl,
				folderId,
				retryAfterMs: parseRetryAfter(res.headers),
			});
		} catch (caught) {
			if (signal?.aborted) throw cancelled();
			error = unreachable(caught, { requestUrl, folderId }, action);
		}
		// Refused a JWT since replaced: sent again at once, without counting the attempt
		if (
			(error.statusCode === 401 || error.statusCode === 403) &&
			renewals < MAX_RENEWALS &&
			renew &&
			(await renew(error))
		) {
			renewals++;
			continue;
		}
		if (signal?.aborted) throw cancelled();
		// Offline in a browser: wait until back online, without counting the attempt
		if (error.statusCode === 0 && (await untilOnline(signal))) {
			if (signal?.aborted) throw cancelled();
			continue;
		}
		if (!isTransient(error)) throw error;
		if (isRateLimited(error)) {
			rateLimitedUntil ??= Date.now() + rateLimitBudgetMs;
			const left = rateLimitedUntil - Date.now();
			if (left > 0) {
				const asked = error.details?.metadata?.retryAfterMs;
				const backoffMs =
					Math.min(SYNC_BACKOFF_BASE_MS * 2 ** waits++, SYNC_BACKOFF_MAX_MS) +
					Math.floor(Math.random() * SYNC_BACKOFF_JITTER_MS);
				await sleep(
					Math.min(
						Math.max(backoffMs, typeof asked === "number" ? asked : 0),
						left,
					),
					signal,
				);
				if (signal?.aborted) throw cancelled();
				continue;
			}
		}
		if (++spent > retries) throw error;
		await sleep(retryDelay(spent, error), signal);
		if (signal?.aborted) throw cancelled();
	}
};
