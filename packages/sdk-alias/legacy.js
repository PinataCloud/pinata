"use strict";

// v2 of @pinata/sdk exported a constructor as the default export
// (`new pinataSDK(key, secret)`). v3 is the `pinata` package, so calling the
// old default export throws a migration hint instead of a cryptic TypeError.
function LegacyPinataSDK() {
	throw new Error(
		"@pinata/sdk v3 is an alias of the `pinata` package and the v2 API has been removed. " +
			"Use `const { PinataSDK } = require('@pinata/sdk')` with `new PinataSDK({ pinataJwt })`, " +
			"or pin `@pinata/sdk@2` to keep the old API. " +
			"Migration guide: https://github.com/PinataCloud/pinata/tree/main/packages/sdk-alias#migrating-from-v2",
	);
}

module.exports = LegacyPinataSDK;
