import { formatConfig } from "../../../utils/format-config";
import { deleteFile, updateFile, swapCid, swapHistory, deleteSwap, vectorizeFile, vectorizeQuery, deleteFileVectors } from "../../functions";
import { PinataConfig, DeleteResponse, UpdateFileOptions, FileListItem, SwapCidOptions, SwapCidResponse, SwapHistoryOptions, VectorizeFileResponse, VectorizeQuery, VectorizeQueryResponse, GetCIDResponse } from "../../types";
import { FilterFiles } from "./FilterFiles";

export class PublicFiles {
  private config: PinataConfig | undefined;

  constructor(config?: PinataConfig) {
    this.config = formatConfig(config);
  }

  list(): FilterFiles {
    return new FilterFiles(this.config, "public");
  }

  delete(files: string[]): Promise<DeleteResponse[]> {
    return deleteFile(this.config, files);
  }

  update(options: UpdateFileOptions): Promise<FileListItem> {
    return updateFile(this.config, options);
  }

  addSwap(options: SwapCidOptions): Promise<SwapCidResponse> {
    return swapCid(this.config, options);
  }

  getSwapHistory(options: SwapHistoryOptions): Promise<SwapCidResponse[]> {
    return swapHistory(this.config, options);
  }

  deleteSwap(cid: string): Promise<string> {
    return deleteSwap(this.config, cid);
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
