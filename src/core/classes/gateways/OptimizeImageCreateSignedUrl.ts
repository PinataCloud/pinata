import {
	PinataConfig,
	AccessLinkOptions,
	OptimizeImageOptions,
} from "../../types";
import { createAccessLink } from "../../functions/gateway/createAccessLink";

export class OptimizeImageCreateAccessLink {
	private config: PinataConfig | undefined;
	private urlOpts: AccessLinkOptions;
	private imgOpts: OptimizeImageOptions = {};

	constructor(config: PinataConfig | undefined, urlOpts: AccessLinkOptions) {
		this.config = config;
		this.urlOpts = urlOpts;
	}

	optimizeImage(options: OptimizeImageOptions): OptimizeImageCreateAccessLink {
		this.imgOpts = { ...this.imgOpts, ...options };
		return this;
	}

	then(
		onfulfilled?: ((value: string) => any) | null,
		onrejected?: ((reason: any) => any) | null,
	): Promise<any> {
		return createAccessLink(this.config, this.urlOpts, this.imgOpts).then(
			onfulfilled,
			onrejected,
		);
	}
}
