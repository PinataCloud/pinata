import { PinataConfig } from "../../types";
import { formatConfig } from "../../../utils/format-config";

import { PublicUpload } from "./PublicUpload";
import { PrivateUpload } from "./PrivateUpload";

export class Upload {
	config: PinataConfig | undefined;
	public: PublicUpload;
	private: PrivateUpload;

	constructor(config?: PinataConfig) {
		this.config = formatConfig(config);
		this.public = new PublicUpload(config);
		this.private = new PrivateUpload(config);
	}

	updateConfig(newConfig: PinataConfig): void {
		this.config = newConfig;
	}
}
