# Pinata

![cover-image](https://docs.mypinata.cloud/ipfs/bafkreidv5iptnieh6eijei7enqc4mdhxpte3ries23heqf7s2hu3gdu6ru)

The new all-in-one Pinata SDK

## Installation

Clone, install, and build

```bash
git clone https://github.com/PinataCloud/pinata
cd pinata
npm install && npm run build
```

Import into your project with the `dist` directory from build

```typescript
import { PinataSDK } from "../dist"
```

## Initialization

```typescript
import { PinataSDK } from "../dist";

const pinata = new PinataSDK({
  pinataJwt: `PINATA_JWT`,
  pinataGateway: `example-sub-domain.mypinata.cloud`,
});
```

## [Full Docs](https://docs.pinata.cloud/sdk-beta/getting-started)
