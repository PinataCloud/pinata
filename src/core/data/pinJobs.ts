/**
 * Uploads multiple file types
 * @returns message
 */

import type {
  PinJobItem,
  PinJobQuery,
  PinJobResponse,
  PinataConfig,
} from "../types";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../utils/custom-errors";

export const pinJobs = async (
  config: PinataConfig | undefined,
  options?: PinJobQuery,
): Promise<PinJobItem[]> => {
  if (!config || !config.pinataJwt) {
    throw new ValidationError("Pinata configuration or JWT is missing");
  }

  const params = new URLSearchParams({
    includesCount: "false",
  });

  if (options) {
    const { ipfs_pin_hash: cid, status, sort, limit, offset } = options;

    if (cid) params.append("ipfs_pin_hash", cid.toString());
    if (status) params.append("status", status.toString());
    if (sort) params.append("sort", sort.toString());
    if (limit) params.append("limit", limit.toString());
    if (offset) params.append("offset", offset.toString());
  }

  const url = `https://api.pinata.cloud/pinning/pinJobs?${params.toString()}`;

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
    const res: PinJobResponse = await request.json();
    return res.rows;
  } catch (error) {
    if (error instanceof PinataError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new PinataError(`Error processing pinJobs: ${error.message}`);
    }
    throw new PinataError("An unknown error occurred while listing pin jobs");
  }
};
