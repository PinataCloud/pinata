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

## Full Docs

Docs are still a WIP, please follow the instructions below

Install Mintlify CLI
```bash
npm i -g mintlify
```

Clone docs repo with the SDK branch
```bash
git clone -b chore/sdk-update https://github.com/PinataCloud/docs && cd docs
```

Run server
```bash
mintlify dev
```

Navigate to SDK page
```
http://localhost:3000/sdk/getting/started
```
