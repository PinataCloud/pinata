/**
 * Removes one or more CIDs (Content Identifiers) from a specified Pinata group.
 *
 * This function allows you to disassociate multiple CIDs from a group in Pinata.
 * It's useful for managing the content within your groups without deleting the actual files.
 *
 * @async
 * @function removeFromGroup
 * @param {PinataConfig | undefined} config - The Pinata configuration object containing the JWT.
 * @param {GroupCIDOptions} options - The options for removing CIDs from a group.
 * @param {string} options.groupId - The ID of the group to remove the CIDs from.
 * @param {string[]} options.cids - An array of CIDs to remove from the group.
 * @returns {Promise<string>} A promise that resolves to a string confirming the removal.
 * @throws {ValidationError} If the Pinata configuration or JWT is missing.
 * @throws {AuthenticationError} If the authentication fails (e.g., invalid JWT).
 * @throws {NetworkError} If there's a network-related error during the API request.
 * @throws {PinataError} For any other errors that occur during the process.
 *
 * @example
 *import { PinataSDK } from "pinata";
 *
 *const pinata = new PinataSDK({
 *  pinataJwt: process.env.PINATA_JWT!,
 *  pinataGateway: "example-gateway.mypinata.cloud",
 *});
 *
 *const group = await pinata.groups.removeCids({
 *	groupId: "3778c10d-452e-4def-8299-ee6bc548bdb0",
 *	cids: ["QmVLwvmGehsrNEvhcCnnsw5RQNseohgEkFNN1848zNzdng"],
 *});
 */

import type {
  GroupCIDOptions,
  PinataConfig,
  UpdateGroupFilesResponse,
} from "../../types";

import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../../utils/custom-errors";

export const removeFromGroup = async (
  config: PinataConfig | undefined,
  options: GroupCIDOptions,
  privacy: "public" | "private"
): Promise<UpdateGroupFilesResponse[]> => {
  if (!config) {
    throw new ValidationError("Pinata configuration is missing");
  }

  const wait = (milliseconds: number): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  };

  const responses: UpdateGroupFilesResponse[] = [];

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
      Source: "sdk/addToGroup",
    };
  }

  let endpoint: string = "https://api.pinata.cloud/v3";

  if (config.endpointUrl) {
    endpoint = config.endpointUrl;
  }

  for (const id of options.files) {
    try {
      const response = await fetch(
        `${endpoint}/groups/${privacy}/${options.groupId}/ids/${id}`,
        {
          method: "DELETE",
          headers: headers,
        },
      );

      await wait(300);

      if (!response.ok) {
        const errorData = await response.text();
        if (response.status === 401) {
          throw new AuthenticationError(
            `Authentication failed: ${errorData}`,
            response.status,
            errorData,
          );
        }
        throw new NetworkError(
          `HTTP error: ${errorData}`,
          response.status,
          errorData,
        );
      }

      responses.push({
        id: id,
        status: response.statusText,
      });
    } catch (error) {
      let errorMessage: string;

      if (error instanceof PinataError) {
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = `Error adding file ${id} to group: ${error.message}`;
      } else {
        errorMessage = `An unknown error occurred while adding file ${id} to group`;
      }

      responses.push({
        id: id,
        status: errorMessage,
      });
    }
  }
  return responses;
};
