import type { PinataConfig } from "../core/types";

const getHeaders = (
  config: PinataConfig,
  sourceHeader: string,
  additionalHeaders: Record<string, string> = {},
) => {
  const headers: Record<string, string> = {
    Source: sourceHeader,
    Authorization: `Bearer ${config.pinataJwt}`,
    ...additionalHeaders,
  };

  if (config.customHeaders) {
    // Overwrite Source header if provided in customHeaders
    if (config.customHeaders.Source) {
      headers.Source = config.customHeaders.Source;
    }

    // Merge other custom headers
    for (const [key, value] of Object.entries(config.customHeaders)) {
      if (key !== "Authorization") {
        headers[key] = value;
      }
    }
  }

  return headers;
};

// Export the helper function so it can be used in other files
export { getHeaders };
