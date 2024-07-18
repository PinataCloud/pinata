/**
 * Tests the current PinataConfig to ensure the used API key is authenticated
 * @returns message
 */

import type { PinataConfig, AuthTestResponse } from "../types";

export const testAuthentication = async (config: PinataConfig | undefined) => {
  const request = await fetch(
    "https://api.pinata.cloud/data/testAuthentication",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config?.pinataJwt}`,
      },
    },
  );
  const res: AuthTestResponse = await request.json();
  if (!request.ok) {
    throw new Error(res.toString());
  }
  return res;
};
