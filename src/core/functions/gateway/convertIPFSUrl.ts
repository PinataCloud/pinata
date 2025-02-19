import { convertToDesiredGateway } from "../../../utils/gateway-tools";
import type { PinataConfig } from "../../types";

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
