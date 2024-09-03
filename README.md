# Pinata

![cover-image](https://docs.mypinata.cloud/ipfs/QmQi9QEuMfsoxVPqhDQdppdyD6HSrUDsaKK5hdTvT1nikw?img-format=webp)

The new all-in-one Pinata SDK

> [!IMPORTANT]
> The `v1.*.*` release is a breaking change and does not support IPFS. Please use the [`pinata-web3`](https://github.com/PinataCloud/pinata-web3) SDK.

## Quickstart

[View the full documentation here](https://docs.pinata.cloud/sdk-beta/getting-started)

### 1. Install

```bash
npm i pinata
```

Import and initialize the SDK in your codebase with the following variables
- [Pinata API Key JWT](https://docs.pinata.cloud/account-management/api-keys)
- [Pinata Gateway Domain](https://docs.pinata.cloud/gateways/dedicated-ipfs-gateways)

```typescript
import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
  pinataJwt: "PINATA_JWT",
  pinataGateway: "example-gateway.mypinata.cloud",
});
```

<Note>The `PINATA_JWT` is a secret key, be sure to initialize the SDK in a secure environment and practice basic variable security practices. If you need to upload from a client environment, consider using signed JWTs</Note>

### 2. Upload a File

```typescript
import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: "example-gateway.mypinata.cloud",
});

async function main() {
  try {
    const file = new File(["hello"], "Testing.txt", { type: "text/plain" });
    const upload = await pinata.upload.file(file);
    console.log(upload);
  } catch (error) {
    console.log(error);
  }
}

await main();
```

This will return an object like the following:

```typescript
{
    id: "349f1bb2-5d59-4cab-9966-e94c028a05b7",
    name: "file.txt",
    cid: "bafybeihgxdzljxb26q6nf3r3eifqeedsvt2eubqtskghpme66cgjyw4fra",
    size: 4682779,
    number_of_files: 1,
    mime_type: "text/plain",
    user_id: "7a484d2c-4219-4f80-9d9d-86b42461e71a",
    group_id: null
}
```

### 3. Retrieve a File

Use the `cid` or from the upload to fetch a file

```typescript
import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: "example-gateway.mypinata.cloud",
});

async function main() {
  try {
    const data = await pinata.gateways.get("bafkreibm6jg3ux5qumhcn2b3flc3tyu6dmlb4xa7u5bf44yegnrjhc4yeq");
    console.log(data)
  } catch (error) {
    console.log(error);
  }
}

main();
```

[View the full documentation here](https://docs.pinata.cloud/sdk/getting-started)

## Developing

```bash
git clone https://github.com/PinataCloud/pinata
cd pinata
npm install
```

Run Build
```bash
npm run build
```

Run Tests
```bash
npm run test
```
