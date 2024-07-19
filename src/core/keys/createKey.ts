/**
 * Uploads multiple file types
 * @returns message
 */

import type { PinataConfig, KeyOptions, KeyResponse } from "../types";

export const createKey = async (
  config: PinataConfig | undefined,
  options: KeyOptions,
): Promise<KeyResponse> => {
  const data = JSON.stringify(options);

  const request = await fetch("https://api.pinata.cloud/v3/pinata/keys", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config?.pinataJwt}`,
    },
    body: data,
  });
  if (!request.ok) {
    throw new Error("Problem creating key");
  }
  const res: KeyResponse = await request.json();
  return res;
};
