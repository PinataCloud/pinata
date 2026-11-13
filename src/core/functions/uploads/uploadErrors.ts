// What the requests of a resumable or folder upload fail with.

import { NetworkError, PinataError } from "../../../utils/custom-errors";
import { serverReason } from "./tusMetadata";

type ErrorMetadata = { requestUrl: string } & Record<string, unknown>;

// A request that got no answer (offline, DNS, connection reset). `action`, if given, says
// what could not be done.
export const unreachable = (
	error: unknown,
	metadata: ErrorMetadata,
	action?: string,
): NetworkError => {
	const message = error instanceof Error ? error.message : String(error);
	const cause = `reach the upload server: ${message}`;
	return new NetworkError(
		action ? `${action}: could not ${cause}` : `Could not ${cause}`,
		0,
		{ error: message, code: "NETWORK_ERROR", metadata },
	);
};

// A request the server refused with `status` and `body`: `<action> (HTTP <status>)`, with
// the server's reason when it gave one
export const refused = (
	action: string,
	status: number,
	body: string,
	metadata: ErrorMetadata,
): NetworkError => {
	const reason = serverReason(body);
	return new NetworkError(
		`${action} (HTTP ${status})${reason ? `: ${reason}` : ""}`,
		status,
		{ error: body, code: "HTTP_ERROR", metadata },
	);
};

// What a folder file, or finishing the folder, fails with once the upload is cancelled
export const cancelled = (): PinataError => {
	const error = new PinataError("The upload was cancelled");
	error.name = "AbortError";
	return error;
};
