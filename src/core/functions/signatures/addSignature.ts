/**
 * Adds a signature to a specific Content Identifier (CID) on Pinata.
 *
 * This function allows you to add a cryptographic signature to a file identified by its CID.
 * It's useful for verifying ownership or authenticity of content stored on IPFS via Pinata.
 *
 * @async
 * @function addSignature
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {SignatureOptions} options - Options for adding the signature.
 * @param {string} options.cid - The Content Identifier (CID) of the file to be signed.
 * @param {string} options.signature - The cryptographic signature to be added.
 * @returns {Promise<SignatureResponse>} A promise that resolves to an object containing the signature details.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {PinataError} If the user is unauthorized to sign the file or if the file already has a signature.
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the signature addition process.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const signature = await pinata.signatures.add({
 *	cid: "QmXGeVy9dVwfuFJmvbzz8y4dYK1TdxXbDGzwbNuyZ5xXSU",
 *	signature: "0x1ba6c2a8412dc9b0be37b013ea5bddd97251dab4d435cc9c4c7bcf331d4017ca2de07485ad6a15ce60d3700cee802787bc7ede0c112c7843f702bb1e71b750911b"
 * })
 */

import type {
  SignatureOptions,
  PinataConfig,
  SignatureResponse,
} from "../../types";

import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../../utils/custom-errors";

export const addSignature = async (
  config: PinataConfig | undefined,
  options: SignatureOptions,
  network: "public" | "private"
): Promise<SignatureResponse> => {
  if (!config) {
    throw new ValidationError("Pinata configuration is missing");
  }

  const data = JSON.stringify({
    signature: options.signature,
    address: options.address
  });

  let headers: Record<string, string>;

  if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
    headers = { ...config.customHeaders };
  } else {
    headers = {
      Authorization: `Bearer ${config.pinataJwt}`,
      "Content-Type": "application/json",
      Source: "sdk/addSignature",
    };
  }

  let endpoint: string = "https://api.pinata.cloud/v3";

  if (config.endpointUrl) {
    endpoint = config.endpointUrl;
  }

  try {
    const request = await fetch(
      `${endpoint}/files/${network}/signature/${options.cid}`,
      {
        method: "POST",
        headers: headers,
        body: data,
      },
    );

    if (!request.ok) {
      const errorData = await request.text();
      if (request.status === 401 || request.status === 403) {
        throw new AuthenticationError(
          `Authentication failed: ${errorData}`,
          request.status,
          {
            error: errorData,
            code: 'AUTH_ERROR',
            metadata: {
              requestUrl: request.url
            }
          },
        );
      }
      if (request.status === 403) {
        throw new PinataError(
          "Unauthorized signing, you must be the original owner of the file and it must not have a signature",
          request.status,
          {
            error: errorData,
            code: 'HTTP_ERROR',
            metadata: {
              requestUrl: request.url
            }
          },
        );
      }
      throw new NetworkError(
        `HTTP error: ${errorData}`,
        request.status,
        {
          error: errorData,
          code: 'HTTP_ERROR',
          metadata: {
            requestUrl: request.url
          }
        },
      );
    }

    const res = await request.json();
    return res.data;
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
