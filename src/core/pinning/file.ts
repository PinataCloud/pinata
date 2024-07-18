/**
 * Uploads multiple file types
 * @returns message
 */

import type { PinataConfig, PinResponse, UploadOptions } from "../types";

export const uploadFile = async (
  config: PinataConfig | undefined,
  file: any,
  options?: UploadOptions,
) => {
  let jwt: string | undefined;
  if (options?.keys) {
    jwt = options.keys;
  } else {
    jwt = config?.pinataJwt;
  }
  const data = new FormData();
  data.append("file", file, file.name);

  data.append(
    "pinataOptions",
    JSON.stringify({
      cidVersion: options?.cidVersion,
      groupId: options?.groupId,
    }),
  );

  data.append(
    "pinataMetadata",
    JSON.stringify({
      name: options?.metadata ? options.metadata.name : file.name,
      keyvalues: options?.metadata?.keyValues,
    }),
  );

  const request = await fetch(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      body: data,
    },
  );

  if (!request.ok) {
    throw new Error("Problem uploading file");
  }
  const res: PinResponse = await request.json();
  return res;
};
