import { ContainsCIDResponse } from "../core/types";

function isValidCIDv0(cid: string): boolean {
	// CIDv0 is a 46-character base58-encoded string starting with "Qm"
	return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid);
}

function isValidCIDv1(cid: string): boolean {
	// CIDv1 typically starts with "b" and uses base32 encoding
	return /^b[a-z2-7]{58,}$/.test(cid);
}

function isCID(str: string): boolean {
	// Remove any leading/trailing whitespace
	str = str.trim();
	return isValidCIDv0(str) || isValidCIDv1(str);
}

export async function containsCID(input: string): Promise<ContainsCIDResponse> {
	if (typeof input !== "string") {
		throw new Error("Input is not a string");
	}

	// Helper function to check if a string starts with a CID
	const startsWithCID = (str: string) => {
		const parts = str.split("/");
		return isCID(parts[0]) ? parts[0] : null;
	};

	// Check if the input itself is a CID or starts with a CID
	const directCID = startsWithCID(input);
	if (directCID) {
		return {
			containsCid: true,
			cid: directCID,
		};
	}

	let url: URL;
	try {
		// Try to parse the input as a URL
		url = new URL(input);
	} catch (error) {
		// If parsing fails, treat the input as a potential path-like string
		const parts = input.split(/\/|\?/);
		for (const part of parts) {
			const cid = startsWithCID(part);
			if (cid) {
				return {
					containsCid: true,
					cid: cid,
				};
			}
		}
		return {
			containsCid: false,
			cid: null,
		};
	}

	// Check for CID in subdomain
	const subdomains = url.hostname.split(".");
	for (const subdomain of subdomains) {
		if (isCID(subdomain)) {
			return {
				containsCid: true,
				cid: subdomain,
			};
		}
	}

	// Check for CID in path
	const pathParts = url.pathname.split("/");
	for (const part of pathParts) {
		const cid = startsWithCID(part);
		if (cid) {
			return {
				containsCid: true,
				cid: cid,
			};
		}
	}

	return {
		containsCid: false,
		cid: null,
	};
}

export async function convertToDesiredGateway(
	sourceUrl: string,
	desiredGatewayPrefix: string | undefined,
) {
	const results = await containsCID(sourceUrl);

	if (results.containsCid !== true) {
		throw new Error("url does not contain CID");
	}

	if (!sourceUrl.startsWith("https") && !sourceUrl.startsWith("ipfs://")) {
		return `${desiredGatewayPrefix}/files/${sourceUrl}`;
	}

	const urlObj = new URL(sourceUrl);
	const path = urlObj.pathname + urlObj.search + urlObj.hash;

	//case 1 - the ipfs://cid path
	if (sourceUrl.startsWith(`ipfs://${results.cid}`)) {
		return `${desiredGatewayPrefix}/files/${results.cid}${path}`;
	}

	//case 2 - the /ipfs/cid path (this should cover ipfs://ipfs/cid as well)
	if (sourceUrl.includes(`/ipfs/${results.cid}`)) {
		return `${desiredGatewayPrefix}${path}`;
	}

	//case 3 - the /ipns/cid path
	if (sourceUrl.includes(`/ipns/${results.cid}`)) {
		return `${desiredGatewayPrefix}${path}`;
	}

	//case 4 - the CID is in the subdomain
	if (urlObj.hostname.includes(results.cid!)) {
		return `${desiredGatewayPrefix}/files/${results.cid}${path}`;
	}

	//this is the fallback if no supported patterns are provided
	throw new Error(
		"unsupported URL pattern, please submit a github issue with the URL utilized",
	);
}
