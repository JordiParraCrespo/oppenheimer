/**
 * Close codes the control plane uses on the runner link.
 *
 * They follow `4000 + HTTP status`, so a runner's log line reads like the HTTP
 * refusal the same condition gets when it is caught before the upgrade: an
 * unpaired host is refused with `410` at the handshake and closed with `4410`
 * when it is unpaired while its link is open. The runner's twin is
 * `apps/runner/internal/link/protocol.go`.
 *
 * The handshake's `410` carries `X-Oppenheimer-Refusal: host-unpaired`, and the
 * runner treats a `410` as terminal only with that header: any proxy in front
 * of the control plane can answer `410`, and a host that took a stranger's as
 * its verdict would stop dialling for good. A `4410` needs no such proof —
 * proxies do not invent codes in the private range.
 *
 * "Unpaired" is a close code rather than a fourth hint because a hint rides a
 * live link, and the point of this one is that the host may not have one.
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
