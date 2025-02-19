import { formatConfig } from "../../../utils/format-config";
import {
	deleteFile,
	updateFile,
	swapCid,
	swapHistory,
	deleteSwap,
	vectorizeFile,
	vectorizeQuery,
	deleteFileVectors,
} from "../../functions";
import { getFile } from "../../functions/files/getFile";
import {
	PinataConfig,
	DeleteResponse,
	UpdateFileOptions,
	FileListItem,
	SwapCidOptions,
	SwapCidResponse,
	SwapHistoryOptions,
	VectorizeFileResponse,
	VectorizeQuery,
	VectorizeQueryResponse,
	GetCIDResponse,
} from "../../types";
import { FilterFiles } from "./FilterFiles";

export class PrivateFiles {
	private config: PinataConfig | undefined;

	constructor(config?: PinataConfig) {
		this.config = formatConfig(config);
	}

	list(): FilterFiles {
		return new FilterFiles(this.config, "private");
	}

	get(id: string): Promise<FileListItem> {
		return getFile(this.config, id, "private");
	}

	delete(files: string[]): Promise<DeleteResponse[]> {
		return deleteFile(this.config, files, "private");
	}

	update(options: UpdateFileOptions): Promise<FileListItem> {
		return updateFile(this.config, options, "private");
	}

	addSwap(options: SwapCidOptions): Promise<SwapCidResponse> {
		return swapCid(this.config, options, "private");
	}

	getSwapHistory(options: SwapHistoryOptions): Promise<SwapCidResponse[]> {
		return swapHistory(this.config, options, "private");
	}

	deleteSwap(cid: string): Promise<string> {
		return deleteSwap(this.config, cid, "private");
	}

	vectorize(fileId: string): Promise<VectorizeFileResponse> {
		return vectorizeFile(this.config, fileId);
	}

	queryVectors(
		options: VectorizeQuery,
	): Promise<VectorizeQueryResponse | GetCIDResponse> {
		return vectorizeQuery(this.config, options);
	}

	deleteVectors(fileId: string): Promise<VectorizeFileResponse> {
		return deleteFileVectors(this.config, fileId);
	}
}
