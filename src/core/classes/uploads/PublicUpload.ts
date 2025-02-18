import { formatConfig } from "../../../utils/format-config";
import { createSignedUploadURL, uploadBase64, uploadFile, uploadFileArray, uploadJson, uploadUrl } from "../../functions";
import { FileObject, PinataConfig, SignedUploadUrlOptions, UploadOptions, UploadResponse } from "../../types";
import { UploadBuilder } from "./UploadBuilder";

export class PublicUpload {
  config: PinataConfig | undefined;

  constructor(config?: PinataConfig) {
    this.config = formatConfig(config);
  }

  updateConfig(newConfig: PinataConfig): void {
    this.config = newConfig;
  }

  file(
    file: FileObject,
    options?: UploadOptions,
  ): UploadBuilder<UploadResponse> {
    return new UploadBuilder(
      this.config,
      (config, file, options) => uploadFile(config, file, "public", options),
      file,
      options
    );
  }

  fileArray(
    files: FileObject[],
    options?: UploadOptions,
  ): UploadBuilder<UploadResponse> {
    return new UploadBuilder(
      this.config,
      (config, file, options) => uploadFileArray(config, file, "public", options),
      files,
      options
    );
  }

  base64(
    base64String: string,
    options?: UploadOptions,
  ): UploadBuilder<UploadResponse> {
    return new UploadBuilder(
      this.config,
      (config, base64String, options) => uploadBase64(config, base64String, "public", options),
      base64String,
      options
    );
  }

  url(url: string, options?: UploadOptions): UploadBuilder<UploadResponse> {
    return new UploadBuilder(
      this.config,
      (config, url, options) => uploadUrl(config, url, "public", options),
      url,
      options
    );
  }

  json(data: object, options?: UploadOptions): UploadBuilder<UploadResponse> {
    return new UploadBuilder(
      this.config,
      (config, data, options) => uploadJson(config, data, "public", options),
      data,
      options
    );
  }

  createSignedURL(options: SignedUploadUrlOptions): Promise<string> {
    return createSignedUploadURL(this.config, options, "public");
  }
}
