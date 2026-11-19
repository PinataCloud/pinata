import { PinataConfig, UploadLimits } from "../../types";
import { getUploadLimits } from "../../functions";
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

	/**
	 * The upload limits of the account the JWT belongs to: `folder_max_files`, the most
	 * files one folder can hold. Needs a key that can read files.
	 */
	limits(): Promise<UploadLimits> {
		return getUploadLimits(this.config);
	}
}
