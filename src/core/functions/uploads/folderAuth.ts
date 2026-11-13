// The JWT a folder upload sends, and its renewal when the server refuses it.

import { PinataError } from "../../../utils/custom-errors";
import type { FolderUploadOptions, PinataConfig } from "../../types";

// How many times in a row a request is sent again because the JWT it was refused was
// replaced, without progress in between
export const MAX_RENEWALS = 2;

// Headers built for each request, and the JWT of the last request they were built for: the
// one a refusal is about
export interface TrackedHeaders {
	headers: () => Record<string, string>;
	jwt: () => string;
}

export class FolderCredentials {
	// An authentication failure no other file can avoid, and the JWT it was for: files not
	// started yet fail with it instead of being sent, until another JWT is in use.
	private refusal: { error: Error; jwt: string } | undefined;
	// The refreshJwt call for a refused JWT, asked once per JWT
	private renewal: { jwt: string; done: Promise<void> } | undefined;

	constructor(
		private readonly config: PinataConfig,
		private readonly options: FolderUploadOptions,
	) {}

	// Built for every request: a JWT set with setNewJwt during a long upload (apps with
	// short-lived tokens replace it as it expires) is used from then on
	headers(): Record<string, string> {
		const jwt = this.options.keys || this.config.pinataJwt;
		return this.config.customHeaders &&
			Object.keys(this.config.customHeaders).length > 0
			? { Authorization: `Bearer ${jwt}`, ...this.config.customHeaders }
			: { Authorization: `Bearer ${jwt}`, Source: "sdk/folder" };
	}

	tracked(): TrackedHeaders {
		let jwt = this.current();
		return {
			headers: () => {
				jwt = this.current();
				return this.headers();
			},
			jwt: () => jwt,
		};
	}

	// The refusal of the JWT in use, which no file can avoid, if there is one
	refused(): Error | undefined {
		return this.refusal && this.refusal.jwt === this.current()
			? this.refusal.error
			: undefined;
	}

	// After `error`, true if it is a 401 or 403 for the JWT `refused` and another JWT is now
	// in use: one set meanwhile (setNewJwt), else one from refreshJwt. A refusal that no
	// other JWT follows is noted (see refused()). A cancel doesn't wait for refreshJwt to
	// settle.
	async renew(error: unknown, refused: string): Promise<boolean> {
		if (
			!(error instanceof PinataError) ||
			(error.statusCode !== 401 && error.statusCode !== 403)
		) {
			return false;
		}
		const { refreshJwt: refresh, signal } = this.options;
		if (this.current() === refused && refresh && !this.options.keys) {
			if (this.renewal?.jwt !== refused) {
				this.renewal = { jwt: refused, done: this.refresh(refresh) };
			}
			// Not past a cancel: a refresh may wait for the user to sign in again
			const pending = this.renewal.done;
			await new Promise<void>((resolve) => {
				if (signal?.aborted) return resolve();
				const done = () => {
					signal?.removeEventListener("abort", done);
					resolve();
				};
				signal?.addEventListener("abort", done, { once: true });
				pending.then(done);
			});
			if (signal?.aborted) return false;
		}
		if (this.current() !== refused) return true;
		if (!this.refused()) this.refusal = { error, jwt: refused };
		return false;
	}

	private current(): string {
		return this.options.keys || this.config.pinataJwt || "";
	}

	private async refresh(
		refresh: NonNullable<FolderUploadOptions["refreshJwt"]>,
	): Promise<void> {
		try {
			const jwt = await refresh();
			// What setNewJwt does: the SDK uses it from then on
			if (jwt) this.config.pinataJwt = jwt;
		} catch {
			// No new JWT: the refusal stands
		}
	}
}
