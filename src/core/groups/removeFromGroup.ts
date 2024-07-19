/**
 * Uploads multiple file types
 * @returns message
 */

import type { GroupCIDOptions, PinataConfig } from "../types";

export const removeFromGroup = async (
  config: PinataConfig | undefined,
  options: GroupCIDOptions,
): Promise<string> => {
  const data = JSON.stringify({
    cids: options.cids,
  });

  const request = await fetch(
    `https://api.pinata.cloud/groups/${options.groupId}/cids`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config?.pinataJwt}`,
      },
      body: data,
    },
  );
  if (!request.ok) {
    throw new Error("Problem removing files from group");
  }
  const res: string = await request.text();
  return res;
};
