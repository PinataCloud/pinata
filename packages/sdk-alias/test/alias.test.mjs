import test from "node:test";
import assert from "node:assert/strict";

import LegacyPinataSDK, * as sdk from "@pinata/sdk";
import * as pinata from "pinata";

test("re-exports every named export of pinata", () => {
	for (const key of Object.keys(pinata)) {
		if (key === "default") continue;
		assert.equal(sdk[key], pinata[key], `missing or different export: ${key}`);
	}
});

test("PinataSDK is the same class as pinata's", () => {
	const client = new sdk.PinataSDK({ pinataJwt: "test" });
	assert.ok(client instanceof pinata.PinataSDK);
});

test("the v2 default import throws a migration hint", () => {
	assert.throws(() => new LegacyPinataSDK("key", "secret"), /v2 API has been removed/);
});
