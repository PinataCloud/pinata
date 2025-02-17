/**
 * Removes the signature associated with a specific Content Identifier (CID) from Pinata.
 *
 * This function allows you to delete the cryptographic signature associated with a file
 * identified by its CID. It's useful for managing ownership claims or updating the
 * authenticity status of content stored on IPFS via Pinata.
 *
 * @async
 * @function removeSignature
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {string} cid - The Content Identifier (CID) of the file whose signature is to be removed.
 * @returns {Promise<string>} A promise that resolves to "OK" if the signature was successfully removed.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the signature removal process.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const signature = await pinata.signatures.delete("QmXGeVy9dVwfuFJmvbzz8y4dYK1TdxXbDGzwbNuyZ5xXSU"
 )
 */

import type { PinataConfig } from "../../types";

import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../../utils/custom-errors";

export const removeSignature = async (
  config: PinataConfig | undefined,
  cid: string,
  network: "public" | "private"
): Promise<string> => {
  if (!config) {
    throw new ValidationError("Pinata configuration is missing");
  }

  let headers: Record<string, string>;

  if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
    headers = { ...config.customHeaders };
  } else {
    headers = {
      Authorization: `Bearer ${config.pinataJwt}`,
      "Content-Type": "application/json",
      Source: "sdk/removeSignature",
    };
  }

  let endpoint: string = "https://api.pinata.cloud/v3";

  if (config.endpointUrl) {
    endpoint = config.endpointUrl;
  }

  try {
    const request = await fetch(`${endpoint}/files/${network}/signature/${cid}`, {
      method: "DELETE",
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
    return "OK";
  } catch (error) {
    if (error instanceof PinataError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new PinataError(`Error processing addSignature: ${error.message}`);
    }
    throw new PinataError(
      "An unknown error occurred while adding signature to CID",
    );
  }
};
