export * from "pinata";

/**
 * @deprecated The v2 default export was removed. Use the named export instead:
 * `import { PinataSDK } from "@pinata/sdk"` with `new PinataSDK({ pinataJwt })`.
 * Calling this throws.
 */
declare const LegacyPinataSDK: (...args: unknown[]) => never;
export default LegacyPinataSDK;
