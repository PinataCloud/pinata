export type KeyPermissions = {
  admin?: boolean;
  endpoints?: Endpoints;
};

export type Endpoints = {
  data?: DataEndponts;
  pinning?: PinningEndpoints;
};

export type DataEndponts = {
  pinList?: boolean;
  userPinnedDataTotal?: boolean;
};

export type PinningEndpoints = {
  hashMetadata?: boolean;
  hashPinPolicy?: boolean;
  pinByHash?: boolean;
  pinFileToIPFS?: boolean;
  pinJSONToIPFS?: boolean;
  pinJobs?: boolean;
  unpin?: boolean;
  userPinPolicy?: boolean;
};

export type KeyOptions = {
  keyName: string;
  permissions: KeyPermissions;
  maxUses?: number;
};

export type KeyResponse = {
  JWT: string;
  pinata_api_key: string;
  pinata_api_secret: string;
};

export type KeyListQuery = {
  revoked?: boolean;
  limitedUse?: boolean;
  exhausted?: boolean;
  name?: string;
  offset?: number;
};

export type KeyListItem = {
  id: string;
  name: string;
  key: string;
  secret: string;
  max_uses: number;
  uses: number;
  user_id: string;
  scopes: KeyScopes;
  revoked: boolean;
  createdAt: string;
  updatedAt: string;
};

type KeyScopes = {
  endpoints: {
    pinning: {
      pinFileToIPFS: boolean;
      pinJSONToIPFS: boolean;
    };
  };
  admin: boolean;
};

export type KeyListResponse = {
  keys: KeyListItem[];
  count: number;
};

export type RevokeKeyResponse = {
  key: string;
  status: string;
};
