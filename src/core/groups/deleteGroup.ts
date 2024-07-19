/**
 * Uploads multiple file types
 * @returns message
 */

import type { GetGroupOptions, PinataConfig } from "../types";

export const deleteGroup = async (
  config: PinataConfig | undefined,
  options: GetGroupOptions,
): Promise<string> => {
  const request = await fetch(
    `https://api.pinata.cloud/groups/${options.groupId}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config?.pinataJwt}`,
      },
    },
  );
  if (!request.ok) {
    throw new Error("Problem deleting group");
  }
  const res: string = await request.text();
  return res;
};
