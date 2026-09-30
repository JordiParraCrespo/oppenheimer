/**
 * The protocol version **this package describes**.
 *
 * One number, one meaning:
 *
 * - a peer built from this package advertises `hello.protocol.max ===
 *   PROTOCOL_VERSION` — that is the contract between this constant and the
 *   `protocol` range on `hello`, and `hello.protocol.min` is the oldest wire the
 *   same peer still accepts;
 * - the control plane's floor is its own constant, not this one
 *   (`MIN_SUPPORTED_PROTOCOL` in the API's runner-link gateway). It is compared
 *   against a connecting runner's advertised range, and a runner below it is
 *   refused at hello *with* an `update_required` hint rather than dropped. The
 *   supported window is N-2;
 * - it is also the `$id` path segment of the emitted JSON Schema, so an artifact
 *   and the code that produced it cannot be mistaken for different versions.
 *
 * See `product/versions/mvp/01-protocol.md`, "Hello, heartbeat and hints".
 */
export const PROTOCOL_VERSION = 1;
