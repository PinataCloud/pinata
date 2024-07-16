# Pinata

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

## [Full Docs](https://docs.pinata.cloud/sdk-beta)
