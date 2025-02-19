import type { PinataConfig } from "../../types";
import { formatConfig } from "../../../utils/format-config";
import { PublicGroups } from "./PublicGroups";
import { PrivateGroups } from "./PrivateGroups";

export class Groups {
	config: PinataConfig | undefined;
	public: PublicGroups;
	private: PrivateGroups;

	constructor(config?: PinataConfig) {
		this.config = formatConfig(config);
		this.public = new PublicGroups(config);
		this.private = new PrivateGroups(config);
	}

	updateConfig(newConfig: PinataConfig): void {
		this.config = newConfig;
	}
}
