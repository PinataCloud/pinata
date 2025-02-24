import { FilterKeys } from "./";
import type {
	PinataConfig,
	KeyOptions,
	KeyResponse,
	RevokeKeyResponse,
} from "../../types";
import { formatConfig } from "../../../utils/format-config";
import { createKey, revokeKeys } from "../../functions";

export class Keys {
	config: PinataConfig | undefined;

	constructor(config?: PinataConfig) {
		this.config = formatConfig(config);
	}

	updateConfig(newConfig: PinataConfig): void {
		this.config = newConfig;
	}

	create(options: KeyOptions): Promise<KeyResponse> {
		return createKey(this.config, options);
	}

	list(): FilterKeys {
		return new FilterKeys(this.config);
	}

	revoke(keys: string[]): Promise<RevokeKeyResponse[]> {
		return revokeKeys(this.config, keys);
	}
}
