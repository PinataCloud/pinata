// The values of a TUS Upload-Metadata header a test server received
export const decodeMetadata = (header: string): Record<string, string> =>
	Object.fromEntries(
		header.split(",").map((pair) => {
			const [key, value = ""] = pair.split(" ");
			return [key, Buffer.from(value, "base64").toString("utf8")];
		}),
	);
