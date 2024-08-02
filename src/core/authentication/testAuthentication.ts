/**
 * Tests the authentication of the current Pinata configuration.
 *
 * This function sends a request to the Pinata API to verify if the provided
 * authentication credentials (JWT) are valid and working correctly.
 *
 * @async
 * @function testAuthentication
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @returns {Promise<AuthTestResponse>} A promise that resolves to an object containing a message about the authentication status.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the authentication process.
 * @example
 *  import { PinataSDK } from "pinata";
 *
 *  const pinata = new PinataSDK({
 *    pinataJwt: process.env.PINATA_JWT!,
 *    pinataGateway: "example-gateway.mypinata.cloud",
 *  });
 *
 *  const auth = await pinata.testAuthentication()
 */

import type { PinataConfig, AuthTestResponse } from "../types";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../utils/custom-errors";

export const testAuthentication = async (config: PinataConfig | undefined) => {
  if (!config || !config.pinataJwt) {
    throw new ValidationError("Pinata configuration or JWT is missing");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config?.pinataJwt}`,
  };

  if (config.customHeaders) {
    Object.assign(headers, config.customHeaders);
  }

  // biome-ignore lint/complexity/useLiteralKeys: non-issue
  headers["Source"] = headers["Source"] || "sdk/testAuthentication";

  try {
    const request = await fetch("https://api.pinata.cloud/data/testAuthentication", {
      method: "GET",
      headers: headers,
    });
    if (!request.ok) {
      const errorData = await request.json();
      if (request.status === 401) {
        throw new AuthenticationError("Authentication failed", request.status, errorData);
      }
      throw new NetworkError(
        `HTTP error! status: ${request.status}`,
        request.status,
        errorData,
      );
    }

    const res: AuthTestResponse = await request.json();
    return res;
  } catch (error) {
    if (error instanceof PinataError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new PinataError(`Error processing authentication: ${error.message}`);
    }
    throw new PinataError("An unknown error occurred while testing authentication");
  }
};
