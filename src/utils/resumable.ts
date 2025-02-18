import { NetworkError } from "./custom-errors";

export function getFileIdFromUrl(url: string): string {
  const match = url.match(/\/files\/([^\/]+)/);
  if (match && match[1]) {
    return match[1];
  }
  throw new NetworkError("File ID not found in URL", 400, {
    error: "File ID not found in URL",
    code: 'HTTP_ERROR',
    metadata: {
      requestUrl: url
    }
  },
  );
}
