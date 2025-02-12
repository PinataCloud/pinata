import { formatConfig } from "../../../utils/format-config";
import { addToGroup, createGroup, deleteGroup, getGroup, removeFromGroup, updateGroup } from "../../functions";
import { GetGroupOptions, GroupCIDOptions, GroupOptions, GroupResponseItem, PinataConfig, UpdateGroupFilesResponse, UpdateGroupOptions } from "../../types";
import { FilterGroups } from "./GroupsFilter";

export class PublicGroups {
  config: PinataConfig | undefined;

  constructor(config?: PinataConfig) {
    this.config = formatConfig(config);
  }

  updateConfig(newConfig: PinataConfig): void {
    this.config = newConfig;
  }

  create(options: GroupOptions): Promise<GroupResponseItem> {
    return createGroup(this.config, options, "public");
  }

  list(): FilterGroups {
    return new FilterGroups(this.config, "public");
  }

  get(options: GetGroupOptions): Promise<GroupResponseItem> {
    return getGroup(this.config, options, "public");
  }

  addFiles(options: GroupCIDOptions): Promise<UpdateGroupFilesResponse[]> {
    return addToGroup(this.config, options);
  }

  removeFiles(options: GroupCIDOptions): Promise<UpdateGroupFilesResponse[]> {
    return removeFromGroup(this.config, options);
  }

  update(options: UpdateGroupOptions): Promise<GroupResponseItem> {
    return updateGroup(this.config, options);
  }

  delete(options: GetGroupOptions): Promise<string> {
    return deleteGroup(this.config, options);
  }
}
