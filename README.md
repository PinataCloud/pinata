# Pinata

![cover-image](https://docs.mypinata.cloud/ipfs/bafkreidv5iptnieh6eijei7enqc4mdhxpte3ries23heqf7s2hu3gdu6ru)

The new all-in-one Pinata SDK

## Quickstart

[View the full documentation here](https://docs.pinata.cloud/sdk-beta/getting-started)

### 1. Install

```bash
npm i pinata
```

Import and initialize the SDK in your codebase with the following variables
- [Pinata API Key JWT](https://docs.pinata.cloud/account-management/api-keys)
- [Pinata Dedicated Gateway Domain](https://docs.pinata.cloud/gateways/dedicated-ipfs-gateways)

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
  IpfsHash: "bafkreibm6jg3ux5qumhcn2b3flc3tyu6dmlb4xa7u5bf44yegnrjhc4yeq",
  PinSize: 5,
  Timestamp: "2024-07-11T23:33:27.665Z",
}
```

### 3. Retrieve a File

Use the CID or `IpfsHash` from the upload to fetch a file

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

[View the full documentation here](https://docs.pinata.cloud/sdk-beta/getting-started)

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
