/**
 * Uploads multiple file types
 * @returns message
 */

import type {
  PinataConfig,
  GroupResponseItem,
  UpdateGroupOptions,
} from "../types";

export const updateGroup = async (
  config: PinataConfig | undefined,
  options: UpdateGroupOptions,
): Promise<GroupResponseItem> => {
  const data = JSON.stringify({
    name: options.name,
  });

  const request = await fetch(
    `https://api.pinata.cloud/groups/${options.groupId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config?.pinataJwt}`,
      },
      body: data,
    },
  );
  if (!request.ok) {
    throw new Error("Problem updating group");
  }
  const res: GroupResponseItem = await request.json();
  return res;
};
