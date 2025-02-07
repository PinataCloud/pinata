import { PinataMetadata } from "./";

export type UploadResponse = {
  id: string;
  name: string;
  cid: string;
  size: number;
  created_at: string;
  number_of_files: number;
  mime_type: string;
  user_id: string;
  group_id: string | null;
  is_duplicate: true | null;
  vectorized: true | null;
};

export type UploadOptions = {
  metadata?: PinataMetadata;
  //pinType?: "async" | "sync" | "cidOnly";
  keys?: string;
  groupId?: string;
  vectorize?: boolean;
  url?: string;
};

export type SignedUploadUrlOptions = {
  date?: number;
  expires: number;
  groupId?: string;
  name?: string;
  keyvalues?: Record<string, string>;
  vectorize?: boolean;
};
