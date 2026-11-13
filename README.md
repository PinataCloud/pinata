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

### Upload a Folder

`folder()` uploads every file as its own resumable upload into one folder, several at a time, each retried on its own, and resolves with the folder's CID and every file's CID:

```typescript
import { FolderUploadError } from "pinata";

// Files from <input type="file" webkitdirectory>, or { path, file } entries
const files = Array.from(input.files!);

try {
  const folder = await pinata.upload.public
    .folder(files, {
      concurrency: 4, // files sending bytes at once
      onProgress: (event) => console.log(event.type, event.index, event.path),
    })
    .name("photos");
  console.log(folder.cid, folder.files);
} catch (error) {
  if (error instanceof FolderUploadError) {
    // The other files are in the folder: send the failed ones again into it
    await pinata.upload.public.folder(
      error.failed.map((f) => ({ path: f.path, file: files[f.index] })),
      { folderId: error.folderId },
    );
  }
}
```

Events (`start`, `sent`, `complete`, `retry`, `error`) carry the file's `index` in the files given. A `signal` cancels the upload, `refreshJwt` renews a JWT the server refuses during a long upload, and an upload whose content was already uploaded resolves with `is_duplicate: true`. See the `FolderUploadOptions` and `FolderUploadEvent` types for the rest.

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
2. **Bump the version** in `package.json` and commit it to `main`. If you use `npm version patch|minor|major --no-git-tag-version`, run `npm run format` afterwards: npm rewrites `package.json` with its own formatting.
3. **Create a GitHub Release** with the tag `v<version>` (e.g. `v2.5.8`) targeting that commit. Publishing the release triggers the `Release` workflow (`.github/workflows/release.yml`), which:
   - checks that the tag matches `package.json` and that the version isn't on npm yet
   - runs the tests, builds, and publishes to npm with [trusted publishing](https://docs.npmjs.com/trusted-publishers) and provenance (no npm token needed). Releases marked as pre-release are published under the `next` dist-tag. Everything else goes to `latest`.
   - runs [git-cliff](https://git-cliff.org/) to generate the changelog. The output is printed in the workflow log; `CHANGELOG.md` is not committed automatically yet.

```bash
# Example: a patch release
npm version patch --no-git-tag-version && npm run format
git commit -am "chore: bump version to 2.5.8" && git push
gh release create v2.5.8 --generate-notes          # add --prerelease for a "next" release
```

### Pre-releases

Create the GitHub Release with **Set as a pre-release** checked (or `gh release create --prerelease`) and a pre-release version such as `2.5.8-rc.0`. It's published under the `next` dist-tag, so `npm i pinata` keeps installing the latest stable version and testers use `npm i pinata@next`.

To promote a pre-release to `latest`, run `npm dist-tag add pinata@<version> latest` as a maintainer. CI isn't allowed to change dist-tags. Usually you cut a stable release (e.g. `2.5.8`) instead.

### `@pinata/sdk` alias

The `@pinata/sdk` package in `packages/sdk-alias` is a thin alias that re-exports `pinata` (see its [README](packages/sdk-alias/README.md)). It depends on `pinata` with a caret range, so new `pinata` releases reach it without republishing. It only needs a release when the alias itself changes or `pinata` ships a new major.

To release it, bump `version` in `packages/sdk-alias/package.json` and push to `main`. `.github/workflows/publish-sdk-alias.yml` runs its tests and publishes the new version with trusted publishing. The dist-tag comes from `publishConfig.tag` in that file. It's `next` while v3 is in preview; change it to `latest` when v3 is promoted.

On every pull request the `Code Quality` workflow (`.github/workflows/code-quality.yml`) runs Biome formatting checks and the Jest test suite.

