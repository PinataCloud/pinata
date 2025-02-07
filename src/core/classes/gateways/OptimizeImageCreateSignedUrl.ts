import { PinataConfig, SignedUrlOptions, OptimizeImageOptions } from "../../types";
import { createSignedURL } from "../../functions";

export class OptimizeImageCreateSignedURL {
  private config: PinataConfig | undefined;
  private urlOpts: SignedUrlOptions;
  private imgOpts: OptimizeImageOptions = {};

  constructor(config: PinataConfig | undefined, urlOpts: SignedUrlOptions) {
    this.config = config;
    this.urlOpts = urlOpts;
  }

  optimizeImage(options: OptimizeImageOptions): OptimizeImageCreateSignedURL {
    this.imgOpts = { ...this.imgOpts, ...options };
    return this;
  }

  then(onfulfilled?: ((value: string) => any) | null): Promise<any> {
    return createSignedURL(this.config, this.urlOpts, this.imgOpts).then(
      onfulfilled,
    );
  }
}
