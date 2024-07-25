/**
 * Description
 * @returns
 */

import { convertToDesiredGateway } from "../../utils/gateway-tools";
import type { PinataConfig } from "../types";

export const convertIPFSUrl = (
	config: PinataConfig | undefined,
	url: string,
): string => {
	let newUrl: string;
	newUrl = convertToDesiredGateway(url, config?.pinataGateway);
	if (config?.pinataGatewayKey) {
		`${newUrl}?pinataGatewayToken=${config?.pinataGatewayKey}`;
	}
	return newUrl;
};
