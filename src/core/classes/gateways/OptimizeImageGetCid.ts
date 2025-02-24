import type {
	PinataConfig,
	OptimizeImageOptions,
	GetCIDResponse,
} from "../../types";
import { getCid } from "../../functions";

export class OptimizeImageGetCid {
	private config: PinataConfig | undefined;
	private cid: string;
	private gatewayType?: "ipfs" | "files";
	private options: OptimizeImageOptions = {};

	constructor(
		config: PinataConfig | undefined,
		cid: string,
		gatewayType?: "ipfs" | "files",
	) {
		this.config = config;
		this.cid = cid;
		this.gatewayType = gatewayType;
	}

	optimizeImage(options: OptimizeImageOptions): OptimizeImageGetCid {
		this.options = { ...this.options, ...options };
		return this;
	}

	then(onfulfilled?: ((value: GetCIDResponse) => any) | null): Promise<any> {
		return getCid(this.config, this.cid, this.gatewayType, this.options).then(
			onfulfilled,
		);
	}
}
