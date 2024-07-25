/**
 * Uploads multiple file types
 * @returns message
 */

import type {
  PinListItem,
  PinListQuery,
  PinListResponse,
  PinataConfig,
} from "../types";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../utils/custom-errors";

export const listFiles = async (
  config: PinataConfig | undefined,
  options?: PinListQuery,
): Promise<PinListItem[]> => {
  if (!config || !config.pinataJwt) {
    throw new ValidationError("Pinata configuration or JWT is missing");
  }

  const params = new URLSearchParams({
    includesCount: "false",
  });

  if (options) {
    const {
      cid,
      pinStart,
      pinEnd,
      pinSizeMin,
      pinSizeMax,
      pageLimit,
      pageOffset,
      name,
      key,
      value,
      operator,
      groupId,
    } = options;

    if (cid) params.append("cid", cid);
    if (pinStart) params.append("pinStart", pinStart);
    if (pinEnd) params.append("pinEnd", pinEnd);
    if (pinSizeMin) params.append("pinSizeMin", pinSizeMin.toString());
    if (pinSizeMax) params.append("pinSizeMax", pinSizeMax.toString());
    if (pageLimit) params.append("pageLimit", pageLimit.toString());
    if (pageOffset) params.append("pageOffset", pageOffset.toString());
    if (groupId) params.append("groupId", groupId);
    if (name) params.append("metadata[name]", name);
    if (key && value) {
      const keyValueParam = JSON.stringify({
        [key]: { value, op: operator || "eq" },
      });
      params.append("metadata[keyvalues]", keyValueParam);
    }
  }

  const url = `https://api.pinata.cloud/data/pinList?status=pinned&${params.toString()}`;

  try {
    const request = await fetch(url, {
      method: "GET",
      headers: {
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

    const res: PinListResponse = await request.json();
    return res.rows;
  } catch (error) {
    if (error instanceof PinataError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new PinataError(`Error processing list files: ${error.message}`);
    }
    throw new PinataError("An unknown error occurred while listing files");
  }
};
