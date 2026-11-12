// Helpers for the headers of a resumable (TUS) upload.

// A TUS Upload-Metadata value: the base64 of the value's UTF-8 bytes. btoa() alone throws
// for characters above U+00FF (CJK, emoji, the combining accents of macOS file names).
export const encodeMetadataValue = (value: string): string => {
	let binary = "";
	for (const byte of new TextEncoder().encode(value)) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
};

// The values of a TUS Upload-Metadata header, decoded as UTF-8. Skips entries that are not
// valid base64.
export const parseUploadMetadata = (
	header: string | null,
): Record<string, string> => {
	const values: Record<string, string> = {};
	for (const pair of header?.split(",") ?? []) {
		const [key, value = ""] = pair.trim().split(" ");
		if (!key) continue;
		try {
			const binary = atob(value);
			const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
			values[key] = new TextDecoder().decode(bytes);
		} catch {
			// Not base64: not a value this client can use
		}
	}
	return values;
};

// Why the server refused a request: the message of a JSON error body, or the body itself
// when it is short plain text. Empty for an HTML error page.
export const serverReason = (body: string): string => {
	try {
		const json = JSON.parse(body);
		const message =
			json?.error?.message ??
			json?.error?.reason ??
			json?.message ??
			(typeof json?.error === "string" ? json.error : undefined);
		if (typeof message === "string" && message) return message;
	} catch {
		// Not JSON
	}
	const text = body.trim();
	return text.startsWith("<") ? "" : text.slice(0, 300);
};
