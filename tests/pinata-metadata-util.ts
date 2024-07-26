// This could be placed in a separate utility file or in the same file as PinataMetadata

import type { PinataMetadata } from "../src/core/types";

// Utility type that matches the actual structure used in the API
type PinataMetadataAPI = Omit<PinataMetadata, "keyValues"> & {
  keyvalues?: Record<string, string | number>;
};

// Utility function to convert PinataMetadata to the format expected by the API
export function toPinataMetadataAPI(
  metadata: PinataMetadata,
): PinataMetadataAPI {
  const { keyValues, ...rest } = metadata;
  return {
    ...rest,
    keyvalues: keyValues,
  };
}
