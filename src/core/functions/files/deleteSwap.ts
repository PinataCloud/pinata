/**
 * Deletes a CID swap
 *
 * This function allows you to remove a CID swap configuration from your Pinata account.
 * It's useful for reverting a CID swap or cleaning up outdated swap configurations.
 *
 * @async
 * @function deleteSwap
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {string} cid - The CID of the swap configuration to be deleted.
 * @returns {Promise<string>} A promise that resolves to a string indicating the result of the deletion operation.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {PinataError} If the deletion is unauthorized or if the CID is not found in the account.
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the deletion process.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const deleteResult = await pinata.gateways.deleteSwap("QmSomeCid123");
 */

import type { SwapCidResponse, PinataConfig } from "../../types";

import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../../utils/custom-errors";

export const deleteSwap = async (
  config: PinataConfig | undefined,
  cid: string,
  network: "public" | "private"
): Promise<string> => {
  if (!config) {
    throw new ValidationError("Pinata configuration is missing");
  }

  let headers: Record<string, string>;

  if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
    headers = {
      Authorization: `Bearer ${config.pinataJwt}`,
      "Content-Type": "application/json",
      ...config.customHeaders,
    };
  } else {
    headers = {
      Authorization: `Bearer ${config.pinataJwt}`,
      "Content-Type": "application/json",
      Source: "sdk/deleteSwap",
    };
  }

  let endpoint: string = "https://api.pinata.cloud/v3";

  if (config.endpointUrl) {
    endpoint = config.endpointUrl;
  }

  try {
    const request = await fetch(`${endpoint}/files/${network}/swap/${cid}`, {
      method: "DELETE",
      headers: headers,
    });

    if (!request.ok) {
      const errorData = await request.text();
      if (request.status === 401 || request.status === 403) {
        throw new AuthenticationError(
          `Authentication failed`,
          request.status,
          {
            error: errorData,
            code: 'AUTH_ERROR'
          }
        );
      }
      if (request.status === 403) {
        throw new PinataError(
          "Unauthorized CID Swap Deletion",
          request.status,
          {
            error: errorData,
            code: 'UNAUTHORIZED'
          }
        );
      }
      if (request.status === 404) {
        throw new PinataError(
          "CID not pinned to account",
          request.status,
          {
            error: errorData,
            code: 'NOT_FOUND'
          }
        );
      }
      throw new NetworkError(
        `HTTP error occurred`,
        request.status,
        {
          error: errorData,
          code: 'NETWORK_ERROR'
        }
      );
    }

    return request.statusText;
  } catch (error) {
    if (error instanceof PinataError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new PinataError(
        `Error processing deleteSwap: ${error.message}`,
        undefined,
        {
          code: 'DELETE_SWAP_ERROR'
        }
      );
    }
    throw new PinataError(
      "An unknown error occurred while deleting swap",
      undefined,
      {
        code: 'UNKNOWN_ERROR'
      }
    );
  }
};
