/**
 * Uploads multiple file types
 * @returns message
 */

import type { PinataConfig, PinataMetadataUpdate } from "../types";

export const updateMetadata = async (
  config: PinataConfig | undefined,
  options: PinataMetadataUpdate,
): Promise<string> => {
  const data = {
    ipfsPinHash: options.cid,
    name: options.name,
    keyvalues: options.keyValues,
  };
  const request = await fetch("https://api.pinata.cloud/pinning/hashMetadata", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config?.pinataJwt}`,
    },
    body: JSON.stringify(data),
  });
  if (!request.ok) {
    throw new Error("Problem updating file");
  }
  const res: string = await request.text();
  return res;
};
