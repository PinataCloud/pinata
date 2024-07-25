/**
 * Uploads multiple file types
 * @returns message
 */

import type { GroupCIDOptions, PinataConfig } from "../types";

import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../utils/custom-errors";

export const addToGroup = async (
  config: PinataConfig | undefined,
  options: GroupCIDOptions,
): Promise<string> => {
  if (!config || !config.pinataJwt) {
    throw new ValidationError("Pinata configuration or JWT is missing");
  }

  const data = JSON.stringify({
    cids: options.cids,
  });

  try {
    const request = await fetch(
      `https://api.pinata.cloud/groups/${options.groupId}/cids`,
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
      const errorData = await request.json();
      if (request.status === 401) {
        throw new AuthenticationError(
          "Authentication failed",
          request.status,
          errorData,
        );
      }
      throw new NetworkError(
        `HTTP error! status: ${request.status}`,
        request.status,
        errorData,
      );
    }

    const res: string = await request.text();
    return res;
  } catch (error) {
    if (error instanceof PinataError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new PinataError(`Error processing addToGroup: ${error.message}`);
    }
    throw new PinataError(
      "An unknown error occurred while adding CIDs to group",
    );
  }
};
