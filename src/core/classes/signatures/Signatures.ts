import { formatConfig } from "../../../utils/format-config";
import { PinataConfig } from "../../types";
import { PrivateSignatures } from "./PrivateSignatures";
import { PublicSignatures } from "./PublicSignatures";

export class Signatures {
  config: PinataConfig | undefined;
  public: PublicSignatures;
  private: PrivateSignatures

  constructor(config?: PinataConfig) {
    this.config = formatConfig(config);
    this.public = new PublicSignatures(config)
    this.private = new PrivateSignatures(config)
  }

  updateConfig(newConfig: PinataConfig): void {
    this.config = newConfig;
  }

}
