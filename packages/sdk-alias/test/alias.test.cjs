"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const sdk = require("@pinata/sdk");
const pinata = require("pinata");

test("re-exports every named export of pinata", () => {
	for (const key of Object.keys(pinata)) {
		assert.equal(sdk[key], pinata[key], `missing or different export: ${key}`);
	}
});

test("PinataSDK is the same class as pinata's", () => {
	const client = new sdk.PinataSDK({ pinataJwt: "test" });
	assert.ok(client instanceof pinata.PinataSDK);
});

test("calling the v2 default export throws a migration hint", () => {
	assert.throws(() => new sdk("key", "secret"), /v2 API has been removed/);
	assert.throws(() => sdk("key", "secret"), /Migration guide/);
});
