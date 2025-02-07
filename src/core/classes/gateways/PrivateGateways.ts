import type { PinataConfig, SignedUrlOptions } from "../../types";
import { OptimizeImageGetCid, OptimizeImageCreateSignedURL } from "./";

export class PrivateGateways {
  private config: PinataConfig | undefined;

  constructor(config: PinataConfig | undefined) {
    this.config = config;
  }

  get(cid: string): OptimizeImageGetCid {
    return new OptimizeImageGetCid(this.config, cid, "files");
  }

  createSignedURL(options: SignedUrlOptions): OptimizeImageCreateSignedURL {
    return new OptimizeImageCreateSignedURL(this.config, options);
  }
}
