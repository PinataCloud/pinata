/**
 * Uploads multiple file types
 * @returns message
 */

import type {
  PinataConfig,
  PinResponse,
  UploadOptions,
  JsonBody,
} from "../types";

export const uploadJson = async <T extends JsonBody>(
  config: PinataConfig | undefined,
  jsonData: T,
  options?: UploadOptions,
) => {
  let jwt: string | undefined;
  if (options?.keys) {
    jwt = options.keys;
  } else {
    jwt = config?.pinataJwt;
  }

  const data = JSON.stringify({
    pinataContent: jsonData,
    pinataOptions: {
      cidVersion: options?.cidVersion,
      groupId: options?.groupId,
    },
    pinataMetadata: {
      name: options?.metadata ? options.metadata.name : "json",
      keyvalues: options?.metadata?.keyValues,
    },
  });

  const request = await fetch(
    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: data,
    },
  );
  if (!request.ok) {
    throw new Error("Problem uploading JSON");
  }
  const res: PinResponse = await request.json();
  return res;
};
