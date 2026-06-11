# Pinata

![cover-image](https://docs.mypinata.cloud/ipfs/QmQi9QEuMfsoxVPqhDQdppdyD6HSrUDsaKK5hdTvT1nikw?img-format=webp)

The new all-in-one Pinata SDK

## Quickstart

[View the full documentation here](https://docs.pinata.cloud/quickstart)

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
    const upload = await pinata.upload.public.file(file);
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
  id: "0195a5c4-242f-7c01-bee8-f34a9e8e804b",
  user_id: "87ef31fe-519b-4ffe-90d9-987771247827",
  group_id: null,
  name: "hello.txt",
  cid: "bafkreid7qoywk77r7rj3slobqfekdvs57qwuwh5d2z3sqsw52iabe3mqne",
  created_at: "2025-03-17T20:20:50.057Z",
  size: 12,
  number_of_files: 1,
  mime_type: "text/plain",
  vectorized: false,
  network: "public",
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
    const data = await pinata.gateways.public.get("bafkreibm6jg3ux5qumhcn2b3flc3tyu6dmlb4xa7u5bf44yegnrjhc4yeq");
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

Run Tests
```bash
npm run test
```

Format with Biome
```bash
npm run format
```

## Building

The SDK is bundled with [`tsup`](https://tsup.egg.js.org/). The build emits CommonJS (`.js`), ES modules (`.mjs`), type declarations (`.d.ts`), and source maps to `dist/` for both the main entry (`pinata`) and the React entry (`pinata/react`).

```bash
npm run build
```

## Releasing

Releases are published to npm and a changelog is generated automatically from [Conventional Commits](https://www.conventionalcommits.org/).

1. **Use Conventional Commit messages** (`feat:`, `fix:`, `chore:`, etc.) so the changelog and version bump are accurate.
2. **Bump the version** in `package.json` (e.g. `npm version patch|minor|major`) and commit it.
3. **Build and publish** the package to npm:
   ```bash
   npm run build
   npm publish
   ```
4. **Create a GitHub Release** for the new version tag. Publishing the release triggers the `Release` workflow (`.github/workflows/release.yml`), which runs [git-cliff](https://git-cliff.org/) to regenerate `CHANGELOG.md`.

On every pull request the `Code Quality` workflow (`.github/workflows/code-quality.yml`) runs Biome formatting checks and the Jest test suite.

