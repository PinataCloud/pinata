import { formatConfig } from "../../../utils/format-config";
import {
	createSignedUploadURL,
	uploadBase64,
	uploadFile,
	uploadFileArray,
	uploadFolder,
	uploadJson,
	uploadUrl,
	uploadCid,
} from "../../functions";
import {
	FileObject,
	FolderEntry,
	FolderUploadOptions,
	FolderUploadResponse,
	PinataConfig,
	SignedUploadUrlOptions,
	UploadOptions,
	UploadResponse,
	UploadCIDOptions,
	PinByCIDResponse,
} from "../../types";
import { UploadBuilder } from "./UploadBuilder";

export class PublicUpload {
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
			(config, file, options) => uploadFile(config, file, "public", options),
			file,
			options,
		);
	}

	fileArray(
		files: File[],
		options?: UploadOptions,
	): UploadBuilder<UploadResponse> {
		return new UploadBuilder(
			this.config,
			(config, file, options) =>
				uploadFileArray(config, file, "public", options),
			files,
			options,
		);
	}

	/**
	 * Uploads a folder file by file, several files at a time, each retried on its own.
	 * `files` are File objects (their `webkitRelativePath` from an <input webkitdirectory>
	 * selection, else their name, is the path) or `{ path, file }` entries. See
	 * FolderUploadOptions for concurrency, retries and progress events.
	 */
	folder(
		files: File[] | FolderEntry[],
		options?: FolderUploadOptions,
	): UploadBuilder<FolderUploadResponse> {
		return new UploadBuilder(
			this.config,
			(config, files, options) =>
				uploadFolder(config, files, "public", options),
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
				uploadBase64(config, base64String, "public", options),
			base64String,
			options,
		);
	}

	url(url: string, options?: UploadOptions): UploadBuilder<UploadResponse> {
		return new UploadBuilder(
			this.config,
			(config, url, options) => uploadUrl(config, url, "public", options),
			url,
			options,
		);
	}

	json(data: object, options?: UploadOptions): UploadBuilder<UploadResponse> {
		return new UploadBuilder(
			this.config,
			(config, data, options) => uploadJson(config, data, "public", options),
			data,
			options,
		);
	}

	cid(
		cid: string,
		options?: UploadCIDOptions,
	): UploadBuilder<PinByCIDResponse> {
		return new UploadBuilder(
			this.config,
			(config, cid, options) => uploadCid(config, cid, options),
			cid,
			options,
		);
	}

	createSignedURL(options: SignedUploadUrlOptions): Promise<string> {
		return createSignedUploadURL(this.config, options, "public");
	}
}
