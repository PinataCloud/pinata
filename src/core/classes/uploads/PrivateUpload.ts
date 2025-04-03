import { formatConfig } from "../../../utils/format-config";
import {
	createSignedUploadURL,
	uploadBase64,
	uploadFile,
	uploadFileArray,
	uploadJson,
	uploadUrl,
} from "../../functions";
import {
	FileObject,
	PinataConfig,
	SignedUploadUrlOptions,
	UploadOptions,
	UploadResponse,
} from "../../types";
import { UploadBuilder } from "./UploadBuilder";

export class PrivateUpload {
	config: PinataConfig | undefined;

	constructor(config?: PinataConfig) {
		this.config = formatConfig(config);
	}

	updateConfig(newConfig: PinataConfig): void {
		this.config = newConfig;
	}

	file(file: File, options?: UploadOptions): UploadBuilder<UploadResponse> {
		return new UploadBuilder(
			this.config,
			(config, file, options) => uploadFile(config, file, "private", options),
			file,
			options,
		);
	}

	// Reserved for future release
	fileArray(
		files: FileObject[],
		options?: UploadOptions,
	): UploadBuilder<UploadResponse> {
		return new UploadBuilder(
			this.config,
			(config, file, options) =>
				uploadFileArray(config, file, "private", options),
			files,
			options,
		);
	}

	base64(
		base64String: string,
		options?: UploadOptions,
	): UploadBuilder<UploadResponse> {
		return new UploadBuilder(
			this.config,
			(config, base64String, options) =>
				uploadBase64(config, base64String, "private", options),
			base64String,
			options,
		);
	}

	url(url: string, options?: UploadOptions): UploadBuilder<UploadResponse> {
		return new UploadBuilder(
			this.config,
			(config, url, options) => uploadUrl(config, url, "private", options),
			url,
			options,
		);
	}

	json(data: object, options?: UploadOptions): UploadBuilder<UploadResponse> {
		return new UploadBuilder(
			this.config,
			(config, data, options) => uploadJson(config, data, "private", options),
			data,
			options,
		);
	}

	createSignedURL(options: SignedUploadUrlOptions): Promise<string> {
		return createSignedUploadURL(this.config, options, "private");
	}
}
