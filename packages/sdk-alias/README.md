# @pinata/sdk

> **This package is an alias of [`pinata`](https://www.npmjs.com/package/pinata).**
> For new projects, install `pinata` directly: `npm i pinata`.

`@pinata/sdk@3` re-exports the official Pinata SDK, so you get the same API, types and releases as `pinata`. The legacy v2 API (`pinFileToIPFS`, `pinJSONToIPFS`, …) has been removed. If you need it, stay on `@pinata/sdk@2`, but it is deprecated and no longer maintained.

- Docs: https://docs.pinata.cloud/sdk
- Source: https://github.com/PinataCloud/pinata

## Install

```bash
npm i @pinata/sdk   # or, preferably: npm i pinata
```

While v3 is in preview it's published under the `next` tag, so `npm i @pinata/sdk` still installs the legacy v2. To try v3 now, run `npm i @pinata/sdk@next`.

Requires Node.js 20 or newer.

## Usage

```ts
import { PinataSDK } from "@pinata/sdk";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT,
	pinataGateway: "example-gateway.mypinata.cloud",
});

const file = new File(["hello world"], "hello.txt", { type: "text/plain" });
const upload = await pinata.upload.public.file(file);
console.log(upload.cid);
```

React hooks are available from `@pinata/sdk/react`, the same as `pinata/react`.

## Migrating from v2

### Setup

v2 exported a constructor as the default export and accepted API key and secret pairs. v3 uses the named `PinataSDK` export and authenticates with a JWT. Create a JWT in the [Pinata app](https://app.pinata.cloud/developers/api-keys).

```js
// v2
const pinataSDK = require("@pinata/sdk");
const pinata = new pinataSDK("yourApiKey", "yourApiSecret");

// v3
const { PinataSDK } = require("@pinata/sdk");
const pinata = new PinataSDK({ pinataJwt: process.env.PINATA_JWT });
```

Calling the old default export in v3 throws an error that points back to this guide.

### Methods

| v2 | v3 |
|---|---|
| `pinFileToIPFS(stream, { pinataMetadata })` | `upload.public.file(file).name(name).keyvalues(kv)` |
| `pinFromFS(path)` | `upload.public.fileArray(files)` |
| `pinJSONToIPFS(obj, { pinataMetadata })` | `upload.public.json(obj).name(name)` |
| `pinByHash(cid)` | `upload.public.cid(cid)` |
| `pinList(filters)` | `files.public.list()` with filters such as `.cid()`, `.name()`, `.keyvalues()`, `.limit()` |
| `hashMetadata(cid, metadata)` | `files.public.update({ id, name, keyvalues })` * |
| `unpin(cid)` | `files.public.delete([id])` * |
| `testAuthentication()` | `testAuthentication()` |

\* These take a file ID, not a CID. Look the ID up first:

```js
const { files } = await pinata.files.public.list().cid(cid);
await pinata.files.public.delete([files[0].id]);
```

### Inputs

v2 accepted Node.js readable streams (for example `fs.createReadStream`). v3 takes web-standard `File` and `Blob` objects, which are available globally in Node.js 20 and newer:

```js
// v2
await pinata.pinFileToIPFS(fs.createReadStream("./photo.png"));

// v3
import { openAsBlob } from "node:fs";
const blob = await openAsBlob("./photo.png");
await pinata.upload.public.file(new File([blob], "photo.png", { type: "image/png" }));
```

### What's new in v3

Groups, private files, signed upload URLs, gateways and access links, resumable uploads for large files, analytics, and more. See the [SDK docs](https://docs.pinata.cloud/sdk).

## License

MIT
