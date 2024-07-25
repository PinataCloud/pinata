/**
 * Uploads multiple file types
 * @returns message
 */

import type { PinataConfig, UserPinnedDataResponse } from "../types";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../utils/custom-errors";

export const totalStorageUsage = async (
  config: PinataConfig | undefined,
): Promise<number> => {
  if (!config || !config.pinataJwt) {
    throw new ValidationError("Pinata configuration or JWT is missing");
  }

  const url = "https://api.pinata.cloud/data/userPinnedDataTotal";

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
    const res: UserPinnedDataResponse = await request.json();
    return res.pin_size_total;
  } catch (error) {
    if (error instanceof PinataError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new PinataError(
        `Error processing totalStorageUsage: ${error.message}`,
      );
    }
    throw new PinataError(
      "An unknown error occurred while getting total storage usage",
    );
  }
};
