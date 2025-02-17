import { formatConfig } from "../../../utils/format-config";
import { addSignature, getSignature, removeSignature } from "../../functions/signatures";
import { PinataConfig, SignatureOptions, SignatureResponse } from "../../types";

export class PublicSignatures {
  config: PinataConfig | undefined;

  constructor(config?: PinataConfig) {
    this.config = formatConfig(config);
  }

  updateConfig(newConfig: PinataConfig): void {
    this.config = newConfig;
  }

  add(options: SignatureOptions): Promise<SignatureResponse> {
    return addSignature(this.config, options, "public");
  }

  get(cid: string): Promise<SignatureResponse> {
    return getSignature(this.config, cid, "public");
  }

  delete(cid: string): Promise<string> {
    return removeSignature(this.config, cid, "public");
  }
}
