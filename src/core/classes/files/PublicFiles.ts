import { formatConfig } from "../../../utils/format-config";
import {
	deleteFile,
	updateFile,
	swapCid,
	swapHistory,
	deleteSwap,
	deletePinRequest,
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
} from "../../types";
import { FilterFiles } from "./FilterFiles";
import { FilterQueue } from "./FilterQueue";

export class PublicFiles {
	private config: PinataConfig | undefined;

	constructor(config?: PinataConfig) {
		this.config = formatConfig(config);
	}

	list(): FilterFiles {
		return new FilterFiles(this.config, "public");
	}

	get(id: string): Promise<FileListItem> {
		return getFile(this.config, id, "public");
	}

	delete(files: string[]): Promise<DeleteResponse[]> {
		return deleteFile(this.config, files, "public");
	}

	update(options: UpdateFileOptions): Promise<FileListItem> {
		return updateFile(this.config, options, "public");
	}

	addSwap(options: SwapCidOptions): Promise<SwapCidResponse> {
		return swapCid(this.config, options, "public");
	}

	getSwapHistory(options: SwapHistoryOptions): Promise<SwapCidResponse[]> {
		return swapHistory(this.config, options, "public");
	}

	deleteSwap(cid: string): Promise<string> {
		return deleteSwap(this.config, cid, "public");
	}

	queue(): FilterQueue {
		return new FilterQueue(this.config);
	}

	deletePinRequest(requestId: string): Promise<string> {
		return deletePinRequest(this.config, requestId);
	}
}
