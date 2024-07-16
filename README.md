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

## Usage

### `testAuthentication`

```typescript
const data = await pinata.testAuthentication()
```

### `upload`

Additional properties after methods

#### `file`

```typescript
const file = new File(["hello"], "Testing.txt", { type: "text/plain" });
const upload = await pinata.upload.file(file);
```
