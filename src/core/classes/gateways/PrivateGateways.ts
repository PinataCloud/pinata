import type { PinataConfig, AccessLinkOptions } from "../../types";
import { OptimizeImageGetCid, OptimizeImageCreateAccessLink } from "./";

export class PrivateGateways {
	private config: PinataConfig | undefined;

	constructor(config: PinataConfig | undefined) {
		this.config = config;
	}

	get(cid: string): OptimizeImageGetCid {
		return new OptimizeImageGetCid(this.config, cid, "files");
	}

	createAccessLink(options: AccessLinkOptions): OptimizeImageCreateAccessLink {
		return new OptimizeImageCreateAccessLink(this.config, options);
	}
}
