/**
 * Uploads JSON data to IPFS via Pinata.
 *
 * This function allows you to upload JSON data directly to IPFS and pin it to Pinata.
 * It's useful for adding structured data, configurations, or any JSON-serializable content
 * to your Pinata account and IPFS network.
 *
 * @async
 * @function uploadJson
 * @template T
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {T} jsonData - The JSON data to be uploaded. Must be a valid JavaScript object that can be JSON-stringified.
 * @param {UploadOptions} [options] - Optional parameters for the upload.
 * @param {PinataMetadata} [options.metadata] - Metadata for the uploaded JSON.
 * @param {string} [options.metadata.name] - Custom name for the JSON content (defaults to "json" if not provided).
 * @param {Record<string, string | number>} [options.metadata.keyValues] - Custom key-value pairs for the JSON metadata.
 * @param {string} [options.keys] - Custom JWT to use for this specific upload.
 * @param {string} [options.groupId] - ID of the group to add the uploaded JSON to.
 * @param {0 | 1} [options.cidVersion] - Version of CID to use (0 or 1).
 * @returns {Promise<PinResponse>} A promise that resolves to an object containing the IPFS hash and other upload details.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the upload process.
 *
 * @example
 * import { PinataSDK } from "pinata";
 *
 * const pinata = new PinataSDK({
 *   pinataJwt: process.env.PINATA_JWT!,
 *   pinataGateway: "example-gateway.mypinata.cloud",
 * });
 *
 * const upload = await pinata.upload.json({
 *   name: "Pinnie NFT",
 *   description: "A Pinnie NFT from Pinata",
 *   image: "ipfs://bafkreih5aznjvttude6c3wbvqeebb6rlx5wkbzyppv7garjiubll2ceym4"
 * })
 */

import type { PinataConfig, PinResponse, UploadOptions, JsonBody } from "../types";

import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../utils/custom-errors";

export const uploadJson = async <T extends JsonBody>(
  config: PinataConfig | undefined,
  jsonData: T,
  options?: UploadOptions,
) => {
  if (!config || !config.pinataJwt) {
    throw new ValidationError("Pinata configuration or JWT is missing");
  }

  const jwt: string = options?.keys || config?.pinataJwt;

  const data = JSON.stringify({
    pinataContent: jsonData,
    pinataOptions: {
      cidVersion: options?.cidVersion,
      groupId: options?.groupId,
    },
    pinataMetadata: {
      name: options?.metadata ? options.metadata.name : "json",
      keyvalues: options?.metadata?.keyValues,
    },
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config?.pinataJwt}`,
  };

  if (config.customHeaders) {
    Object.assign(headers, config.customHeaders);
  }

  // biome-ignore lint/complexity/useLiteralKeys: non-issue
  headers["Source"] = headers["Source"] || "sdk/json";

  try {
    const request = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: headers,
      body: data,
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

    const res: PinResponse = await request.json();
    return res;
  } catch (error) {
    if (error instanceof PinataError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new PinataError(`Error processing json: ${error.message}`);
    }
    throw new PinataError("An unknown error occurred while uploading json");
  }
};
