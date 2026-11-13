// The final sync of a folder upload, which computes the folder's CID.

import type { NetworkError } from "../../../utils/custom-errors";
import { MAX_RENEWALS } from "./folderAuth";
import {
	isTransient,
	parseRetryAfter,
	retryDelay,
	sleep,
	untilOnline,
} from "./retry";
import { type RequestHeaders, resolveHeaders } from "./tusStatus";
import { cancelled, refused, unreachable } from "./uploadErrors";

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

// Computes the folder's CID from every registered file and says how many files it holds.
// `renew`, after a refusal: true if another JWT is now in use (see FolderCredentials).
export const syncFolder = async (
	endpoint: string,
	folderId: string,
	headers: RequestHeaders,
	retries: number,
	signal?: AbortSignal,
	renew?: (error: Error) => Promise<boolean>,
): Promise<SyncedFolder> => {
	const requestUrl = `${endpoint}/buckets/${folderId}/sync`;
	const action = "Could not finish the folder";
	for (let spent = 0, renewals = 0; ; ) {
		let error: NetworkError;
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
		if (!isTransient(error) || ++spent > retries) {
			throw error;
		}
		await sleep(retryDelay(spent, error), signal);
		if (signal?.aborted) throw cancelled();
	}
};
