/**
 * Uploads multiple file types
 * @returns message
 */

import type { PinataConfig, PinResponse, UploadOptions } from "../types";

export const uploadFileArray = async (
  config: PinataConfig | undefined,
  files: any,
  options?: UploadOptions,
) => {
  let jwt: string | undefined;
  if (options?.keys) {
    jwt = options.keys;
  } else {
    jwt = config?.pinataJwt;
  }

  const folder = options?.metadata?.name
    ? options?.metadata?.name
    : "folder_from_sdk";
  const data = new FormData();

  Array.from(files).forEach((file: any) => {
    data.append("file", file, `${folder}/${file.name}`);
  });

  data.append(
    "pinataMetadata",
    JSON.stringify({
      name: folder,
      keyvalues: options?.metadata?.keyValues,
    }),
  );

  data.append(
    "pinataOptions",
    JSON.stringify({
      cidVersion: options?.cidVersion,
      groupId: options?.groupId,
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
    throw new Error("Problem uploading files");
  }
  const res: PinResponse = await request.json();
  return res;
};
