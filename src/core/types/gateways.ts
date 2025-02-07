export type ContentType =
  | "application/json"
  | "application/xml"
  | "text/plain"
  | "text/html"
  | "text/css"
  | "text/javascript"
  | "application/javascript"
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/svg+xml"
  | "audio/mpeg"
  | "audio/ogg"
  | "video/mp4"
  | "application/pdf"
  | "application/octet-stream"
  | string
  | null; // Allow for other MIME types

export type GetCIDResponse = {
  data?: JSON | string | Blob | null;
  contentType: ContentType;
};

export type OptimizeImageOptions = {
  width?: number;
  height?: number;
  dpr?: number;
  fit?: "scaleDown" | "contain" | "cover" | "crop" | "pad";
  gravity?: "auto" | "side" | string;
  quality?: number;
  format?: "auto" | "webp";
  animation?: boolean;
  sharpen?: number;
  onError?: boolean;
  metadata?: "keep" | "copyright" | "none";
};

export type SignedUrlOptions = {
  cid: string;
  date?: number;
  expires: number;
  gateway?: string;
};

export type ContainsCIDResponse = {
  containsCid: boolean;
  cid: string | null;
};
