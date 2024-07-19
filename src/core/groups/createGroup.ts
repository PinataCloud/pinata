/**
 * Uploads multiple file types
 * @returns message
 */

import type { PinataConfig, GroupOptions, GroupResponseItem } from "../types";

export const createGroup = async (
  config: PinataConfig | undefined,
  options: GroupOptions,
): Promise<GroupResponseItem> => {
  const data = JSON.stringify(options);

  const request = await fetch("https://api.pinata.cloud/groups", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config?.pinataJwt}`,
    },
    body: data,
  });
  if (!request.ok) {
    throw new Error("Problem creating group");
  }
  const res: GroupResponseItem = await request.json();
  return res;
};
