/**
 * Global replacements, installed before the root component registers.
 * A polyfill imported second is a polyfill that did nothing.
 */
import { getRandomValues, randomUUID } from 'expo-crypto';
import { fetch, Headers, Request, Response } from 'react-native-nitro-fetch';

globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
globalThis.Headers = Headers as unknown as typeof globalThis.Headers;
globalThis.Request = Request as unknown as typeof globalThis.Request;
globalThis.Response = Response as unknown as typeof globalThis.Response;

// Hermes has no Web Crypto. The product package mints ids with
// `crypto.randomUUID()` (a bot message drawn before the API answers), so the
// two calls it makes come from the platform's own secure generator.
const webCrypto = (globalThis.crypto ?? {}) as Crypto;
if (typeof webCrypto.randomUUID !== 'function') {
  webCrypto.randomUUID = randomUUID as Crypto['randomUUID'];
}
if (typeof webCrypto.getRandomValues !== 'function') {
  webCrypto.getRandomValues = getRandomValues as Crypto['getRandomValues'];
}
globalThis.crypto = webCrypto;
