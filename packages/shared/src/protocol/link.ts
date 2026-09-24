/**
 * Close codes the control plane uses on the runner link.
 *
 * They follow `4000 + HTTP status`, so a runner's log line reads like the HTTP
 * refusal the same condition gets when it is caught before the upgrade: an
 * unpaired host is refused with `410` at the handshake and closed with `4410`
 * when it is unpaired while its link is open. The runner's twin is
 * `apps/runner/internal/link/protocol.go`.
 */
export const RUNNER_LINK_CLOSE_CODES = Object.freeze({
  /** The first frame was not a valid hello, or a second hello arrived. */
  HELLO_EXPECTED: 4400,
  /** No hello arrived within the timeout. */
  HELLO_TIMEOUT: 4408,
  /** A newer link from the same host replaced this one. */
  REPLACED: 4409,
  /**
   * The host was unpaired. **Terminal**: the runner stops dialling instead of
   * walking its reconnect ladder against a control plane that will never take it
   * back, and says so in `runner status`.
   */
  UNPAIRED: 4410,
  /** The protocol ranges do not overlap; a hint was sent first. */
  PROTOCOL_MISMATCH: 4426,
});
