import { formatConfig } from "../../../utils/format-config";
import { pinnedFileCount, totalStorageUsage } from "../../functions";
import { PinataConfig } from "../../types";

export class Usage {
  config: PinataConfig | undefined;

  constructor(config?: PinataConfig) {
    this.config = formatConfig(config);
  }

  updateConfig(newConfig: PinataConfig): void {
    this.config = newConfig;
  }

  pinnedFileCount(): Promise<number> {
    return pinnedFileCount(this.config);
  }

  totalStorageSize(): Promise<number> {
    return totalStorageUsage(this.config);
  }
}
