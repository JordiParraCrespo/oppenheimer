import { webcrypto } from 'node:crypto';

// jsdom under the `vmThreads` pool gives each file a VM context without the
// Web Crypto global a browser has, so the direct path's host-proof specs found
// `crypto.subtle` undefined. Node's implementation is the same API.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
