import { convertIPFSUrl } from "../../functions";
import { PinataConfig } from "../../types";
import { OptimizeImageGetCid } from "./";

export class PublicGateways {
	private config: PinataConfig | undefined;

	constructor(config: PinataConfig | undefined) {
		this.config = config;
	}

	get(cid: string): OptimizeImageGetCid {
		return new OptimizeImageGetCid(this.config, cid, "ipfs");
	}

	convert(url: string, gatewayPrefix?: string): Promise<string> {
		return convertIPFSUrl(this.config, url, gatewayPrefix);
	}
}
