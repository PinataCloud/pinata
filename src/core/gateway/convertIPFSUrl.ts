/**
 * Converts an IPFS URL to a desired gateway URL.
 *
 * This function takes an IPFS URL and converts it to use a specified gateway.
 * If a Pinata Gateway Key is provided in the configuration, it will be appended
 * to the URL as a query parameter.
 *
 * @function convertIPFSUrl
 * @param {PinataConfig | undefined} config - The Pinata configuration object.
 * @param {string} config.pinataGateway - The desired gateway URL to use.
 * @param {string} [config.pinataGatewayKey] - Optional Pinata Gateway Key for authenticated access.
 * @param {string} url - The original IPFS URL to convert.
 * @returns {Promise<string>} The converted URL using the specified gateway.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const url = await pinata.gateways.convert(
 *   "ipfs://QmVLwvmGehsrNEvhcCnnsw5RQNseohgEkFNN1848zNzdng"
 * );
 */

import { convertToDesiredGateway } from "../../utils/gateway-tools";
import type { PinataConfig } from "../types";

export const convertIPFSUrl = async (
	config: PinataConfig | undefined,
	url: string,
	gatewayPrefix?: string,
): Promise<string> => {
	let newUrl: string;
	let prefix: string =
		gatewayPrefix || config?.pinataGateway || "https://gateway.pinata.cloud";
	newUrl = await convertToDesiredGateway(url, prefix);
	if (config?.pinataGatewayKey) {
		`${newUrl}?pinataGatewayToken=${config?.pinataGatewayKey}`;
	}
	return newUrl;
};
