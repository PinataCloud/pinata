/**
 * Uploads multiple file types
 * @returns message
 */

import type { PinataConfig, KeyOptions, KeyResponse } from "../types";

import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../utils/custom-errors";

export const createKey = async (
  config: PinataConfig | undefined,
  options: KeyOptions,
): Promise<KeyResponse> => {
  if (!config || !config.pinataJwt) {
    throw new ValidationError("Pinata configuration or JWT is missing");
  }

  const data = JSON.stringify(options);

  try {
    const request = await fetch("https://api.pinata.cloud/v3/pinata/keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config?.pinataJwt}`,
      },
      body: data,
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

    const res: KeyResponse = await request.json();
    return res;
  } catch (error) {
    if (error instanceof PinataError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new PinataError(`Error processing createKey: ${error.message}`);
    }
    throw new PinataError("An unknown error occurred while creating API key");
  }
};
