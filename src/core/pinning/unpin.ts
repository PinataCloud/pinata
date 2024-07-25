/**
 * Unpins multiple files from Pinata
 * @returns Array of responses for each unpin attempt
 */

import type { PinataConfig, UnpinResponse } from "../types";
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

export const unpinFile = async (
  config: PinataConfig | undefined,
  files: string[],
): Promise<UnpinResponse[]> => {
  if (!config || !config.pinataJwt) {
    throw new ValidationError("Pinata configuration or JWT is missing");
  }

  const responses: UnpinResponse[] = [];

  for (const hash of files) {
    try {
      const response = await fetch(
        `https://api.pinata.cloud/pinning/unpin/${hash}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.pinataJwt}`,
          },
        },
      );

      await wait(300);

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 401) {
          throw new AuthenticationError(
            "Authentication failed",
            response.status,
            errorData,
          );
        }
        throw new NetworkError(
          `HTTP error! status: ${response.status}`,
          response.status,
          errorData,
        );
      }

      const result = await response.text();
      responses.push({
        hash: hash,
        status: result,
      });
    } catch (error) {
      let errorMessage: string;

      if (error instanceof PinataError) {
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = `Error unpinning file ${hash}: ${error.message}`;
      } else {
        errorMessage = `An unknown error occurred while unpinning file ${hash}`;
      }

      responses.push({
        hash: hash,
        status: errorMessage,
      });
    }
  }
  return responses;
};
