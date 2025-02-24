import { PinataConfig } from "../../types";

import { formatConfig } from "../../../utils/format-config";

import { PublicFiles } from "./PublicFiles";
import { PrivateFiles } from "./PrivateFiles";

export class Files {
	config: PinataConfig | undefined;
	public: PublicFiles;
	private: PrivateFiles;

	constructor(config?: PinataConfig) {
		this.config = formatConfig(config);
		this.public = new PublicFiles(config);
		this.private = new PrivateFiles(config);
	}

	updateConfig(newConfig: PinataConfig): void {
		this.config = newConfig;
	}
}
