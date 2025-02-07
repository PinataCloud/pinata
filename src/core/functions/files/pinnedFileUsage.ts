/**
 * Retrieves the total count of files pinned to Pinata for the authenticated user.
 *
 * This function makes a request to the Pinata API to fetch the total number of files
 * that the user has pinned to their account. This can be useful for monitoring
 * account usage and managing pinned content.
 *
 * @async
 * @function pinnedFileCount
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @returns {Promise<number>} A promise that resolves to the total number of pinned files.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the retrieval process.
 *
 * @example
 * const config = { pinataJwt: 'your-jwt-token' };
 * try {
 *   const count = await pinnedFileCount(config);
 *   console.log(`Total pinned files: ${count}`);
 * } catch (error) {
 *   console.error('Error getting pinned file count:', error);
 * }
 */

import type { PinataConfig, UserPinnedDataResponse } from "../../types";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../../utils/custom-errors";

export const pinnedFileCount = async (
  config: PinataConfig | undefined,
): Promise<number> => {
  if (!config) {
    throw new ValidationError("Pinata configuration is missing");
  }

  let endpoint: string = "https://api.pinata.cloud";

  if (config.endpointUrl) {
    endpoint = config.endpointUrl;
  }

  let headers: Record<string, string>;

  if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
    headers = {
      Authorization: `Bearer ${config.pinataJwt}`,
      ...config.customHeaders,
    };
  } else {
    headers = {
      Authorization: `Bearer ${config.pinataJwt}`,
      Source: "sdk/pinnedFileUsage",
    };
  }

  try {
    const request = await fetch(`${endpoint}/data/userPinnedDataTotal`, {
      method: "GET",
      headers: headers,
    });
    if (!request.ok) {
      const errorData = await request.text();
      if (request.status === 401 || request.status === 403) {
        throw new AuthenticationError(
          `Authentication failed: ${errorData}`,
          request.status,
          errorData,
        );
      }
      throw new NetworkError(
        `HTTP error: ${errorData}`,
        request.status,
        errorData,
      );
    }
    const res: UserPinnedDataResponse = await request.json();
    return res.pin_count;
  } catch (error) {
    if (error instanceof PinataError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new PinataError(
        `Error processing pinnedFileUsage: ${error.message}`,
      );
    }
    throw new PinataError(
      "An unknown error occurred while getting pinned file usage",
    );
  }
};
