/**
 * Close codes the control plane uses on the runner link.
 *
 * They follow `4000 + HTTP status`, so a runner's log line reads like the HTTP
 * refusal the same condition gets when it is caught before the upgrade: an
 * unpaired host is refused with `410` at the handshake and closed with `4410`
 * when it is unpaired while its link is open. The runner does not keep a twin:
 * the schema artifact carries every constant in this file under `x-constants`,
 * and `scripts/emit-link-protocol.cjs` writes them into
 * `apps/runner/internal/link/protocol.gen.go`.
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

/**
 * The header on the control plane's own handshake refusal. A bare `410` is not
 * trusted — any proxy in front of the control plane can answer one — and a host
 * that took a stranger's as "unpaired" would stop dialling for good, so the
 * runner acts on a refusal only when this header names one of
 * {@link RUNNER_LINK_REFUSALS}.
 */
export const RUNNER_LINK_REFUSAL_HEADER = 'X-Oppenheimer-Refusal';

/** The refusals the runner acts on rather than retries. */
export const RUNNER_LINK_REFUSALS = Object.freeze({
  /** The host was unpaired: the handshake twin of `RUNNER_LINK_CLOSE_CODES.UNPAIRED`. */
  UNPAIRED: 'host-unpaired',
});

/**
 * The 4-byte big-endian attachment id every binary frame on the link starts
 * with (`product/versions/mvp/01-protocol.md`, "Framing"). No JSON, no base64,
 * and nothing else in the header.
 */
export const LINK_FRAME_HEADER_BYTES = 4;

/**
 * 01's 256 KB: the bytes an attachment may have in flight before the runner
 * pauses its PTY reads. `attachment.credit` replenishes it with deltas, so only
 * the runner counts against it, but it is the window a browser's acks refill.
 */
export const ATTACHMENT_CREDIT_WINDOW_BYTES = 256 * 1024;

/**
 * The largest frame a peer puts on the link, text or binary. The control plane
 * refuses a bigger one from a runner with 1009 before buffering it (`ws`'s
 * `maxPayload`), and the runner reads no bigger one and never sends one. A
 * control frame this large is not a control frame, and a PTY frame is at most
 * 32 KiB plus its header; the one message that grows with the host is the
 * session list in `hello` and `heartbeat`, which the runner fits to it.
 */
export const LINK_MAX_FRAME_BYTES = 512 * 1024;
