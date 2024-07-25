/**
 * Uploads multiple file types
 * @returns message
 */

import type {
  KeyListItem,
  KeyListQuery,
  KeyListResponse,
  PinataConfig,
} from "../types";

import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../utils/custom-errors";

export const listKeys = async (
  config: PinataConfig | undefined,
  options?: KeyListQuery,
): Promise<KeyListItem[]> => {
  if (!config || !config.pinataJwt) {
    throw new ValidationError("Pinata configuration or JWT is missing");
  }

  const params = new URLSearchParams();

  if (options) {
    const { offset, name, revoked, limitedUse, exhausted } = options;

    if (offset) params.append("offset", offset.toString());
    if (revoked !== undefined) params.append("revoked", revoked.toString());
    if (limitedUse !== undefined)
      params.append("limitedUse", limitedUse.toString());
    if (exhausted !== undefined)
      params.append("exhausted", exhausted.toString());
    if (name) params.append("name", name);
  }

  const url = `https://api.pinata.cloud/v3/pinata/keys?${params.toString()}`;

  try {
    const request = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config?.pinataJwt}`,
      },
    });

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

    const res: KeyListResponse = await request.json();
    return res.keys;
  } catch (error) {
    if (error instanceof PinataError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new PinataError(`Error processing listKeys: ${error.message}`);
    }
    throw new PinataError("An unknown error occurred while listing API keys");
  }
};
