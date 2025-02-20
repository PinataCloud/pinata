import { testAuthentication } from "./functions";
import { formatConfig } from "../utils";
import {
  Analytics,
  Groups,
  Keys,
  Gateways,
  Files,
  Upload,
  Signatures,
} from "./classes";
import { PinataConfig } from "./types";

export class PinataSDK {
  config: PinataConfig | undefined;
  files: Files;
  upload: Upload;
  gateways: Gateways;
  //	usage: Usage;
  keys: Keys;
  groups: Groups;
  analytics: Analytics;
  signatures: Signatures;

  constructor(config?: PinataConfig) {
    this.config = formatConfig(config);
    this.files = new Files(this.config);
    this.upload = new Upload(this.config);
    this.gateways = new Gateways(this.config);
    //		this.usage = new Usage(this.config);
    this.keys = new Keys(this.config);
    this.groups = new Groups(this.config);
    this.analytics = new Analytics(this.config);
    this.signatures = new Signatures(this.config);
  }

  setNewHeaders(headers: Record<string, string>): void {
    if (!this.config) {
      this.config = { pinataJwt: "", customHeaders: {} };
    }
    this.config.customHeaders = { ...this.config.customHeaders, ...headers };

    // Update headers for all sub-modules
    this.files.updateConfig(this.config);
    this.upload.updateConfig(this.config);
    this.gateways.updateConfig(this.config);
    //		this.usage.updateConfig(this.config);
    this.keys.updateConfig(this.config);
    this.groups.updateConfig(this.config);
    this.analytics.updateConfig(this.config);
    this.signatures.updateConfig(this.config);
  }

  setNewJwt(jwt: string): void {
    if (!this.config) {
      this.config = { pinataJwt: "" };
    }
    this.config.pinataJwt = jwt;

    // Update headers for all sub-modules
    this.files.updateConfig(this.config);
    this.upload.updateConfig(this.config);
    this.gateways.updateConfig(this.config);
    //		this.usage.updateConfig(this.config);
    this.keys.updateConfig(this.config);
    this.groups.updateConfig(this.config);
    this.analytics.updateConfig(this.config);
    this.signatures.updateConfig(this.config);
  }

  testAuthentication(): Promise<string> {
    return testAuthentication(this.config);
  }
}
