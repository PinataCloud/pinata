/**
 * Revokes multiple API keys from the Pinata account.
 *
 * This function allows you to revoke (invalidate) multiple API keys at once.
 * It's useful for security purposes, such as when keys may have been compromised
 * or are no longer needed.
 *
 * @async
 * @function revokeKeys
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {string[]} keys - An array of API key strings to be revoked.
 * @returns {Promise<RevokeKeyResponse[]>} A promise that resolves to an array of objects,
 *   each containing the status of the revocation attempt for each key.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the key revocation process.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const revoke = await pinata.keys.revoke([
 *  "94566af5e63833e260be"
 * ]);
 */

import type { PinataConfig, RevokeKeyResponse } from "../types";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../utils/custom-errors";

const wait = (milliseconds: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

export const revokeKeys = async (
  config: PinataConfig | undefined,
  keys: string[],
): Promise<RevokeKeyResponse[]> => {
  if (!config || !config.pinataJwt) {
    throw new ValidationError("Pinata configuration or JWT is missing");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config?.pinataJwt}`,
  };

  if (config.customHeaders) {
    Object.assign(headers, config.customHeaders);
  }

  // biome-ignore lint/complexity/useLiteralKeys: non-issue
  headers["Source"] = headers["Source"] || "sdk/revokeKey";

  const responses: RevokeKeyResponse[] = [];

  for (const key of keys) {
    try {
      const request = await fetch(`https://api.pinata.cloud/v3/pinata/keys/${key}`, {
        method: "PUT",
        headers: headers,
      });

      await wait(300);

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

      const result: string = await request.json();
      responses.push({
        key: key,
        status: result,
      });
    } catch (error) {
      let errorMessage: string;

      if (error instanceof PinataError) {
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = `Error revoking key ${key}: ${error.message}`;
      } else {
        errorMessage = `An unknown error occurred while revoking key ${key}`;
      }

      responses.push({
        key: key,
        status: errorMessage,
      });
    }
  }

  return responses;
};
