/**
 * Uploads multiple file types
 * @returns message
 */

import type {
  PinataConfig,
  GroupResponseItem,
  GroupQueryOptions,
} from "../types";

import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../utils/custom-errors";

export const listGroups = async (
  config: PinataConfig | undefined,
  options?: GroupQueryOptions,
): Promise<GroupResponseItem[]> => {
  if (!config || !config.pinataJwt) {
    throw new ValidationError("Pinata configuration or JWT is missing");
  }

  const params = new URLSearchParams();

  if (options) {
    const { offset, nameContains, limit } = options;

    if (offset) params.append("offset", offset.toString());
    if (nameContains !== undefined)
      params.append("nameContains", nameContains.toString());
    if (limit !== undefined) params.append("limit", limit.toString());
  }

  const url = `https://api.pinata.cloud/groups?${params.toString()}`;

  try {
    const request = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config?.pinataJwt}`,
      },
    });
    if (!request.ok) {
      throw new Error("Problem listing Groups");
    }
    const res: GroupResponseItem[] = await request.json();
    return res;
  } catch (error) {
    if (error instanceof PinataError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new PinataError(`Error processing listGroups: ${error.message}`);
    }
    throw new PinataError("An unknown error occurred while listing groups");
  }
};
