import { PinataConfig, FileObject, UploadOptions, UploadResponse, SignedUploadUrlOptions } from '../../types';
import { uploadFile, uploadBase64, uploadUrl, uploadJson, createSignedUploadURL } from '../../functions';
import { formatConfig } from '../../../utils/format-config';
import { UploadBuilder } from './';

export class Upload {
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
    return new UploadBuilder(this.config, uploadFile, file, options);
  }

  // fileArray(
  // 	files: FileObject[],
  // 	options?: UploadOptions,
  // ): UploadBuilder<UploadResponse> {
  // 	return new UploadBuilder(this.config, uploadFileArray, files, options);
  // }

  base64(
    base64String: string,
    options?: UploadOptions,
  ): UploadBuilder<UploadResponse> {
    return new UploadBuilder(this.config, uploadBase64, base64String, options);
  }

  url(url: string, options?: UploadOptions): UploadBuilder<UploadResponse> {
    return new UploadBuilder(this.config, uploadUrl, url, options);
  }

  json(data: object, options?: UploadOptions): UploadBuilder<UploadResponse> {
    return new UploadBuilder(this.config, uploadJson, data, options);
  }

  createSignedURL(options: SignedUploadUrlOptions): Promise<string> {
    return createSignedUploadURL(this.config, options);
  }
}
