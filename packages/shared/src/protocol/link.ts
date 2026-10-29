/**
 * Close codes the control plane uses on the runner link.
 *
 * They follow `4000 + HTTP status`, so a runner's log line reads like the HTTP
 * refusal the same condition gets when it is caught before the upgrade: an
 * unpaired host is refused with `410` at the handshake and closed with `4410`
 * when it is unpaired while its link is open. The runner does not keep a twin:
 * every constant in this file reaches `protocol.gen.go` through the schema's
 * `x-constants` (`./json-schema.ts`).
 *
 * The handshake's `410` is terminal only with {@link RUNNER_LINK_REFUSAL_HEADER}.
 * A `4410` needs no such proof — proxies do not invent codes in the private range.
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
 * The reasons a close may carry on top of its code. A reason only refines a code
 * the runner already acts on, so a runner too old to know one still does the
 * code's part and nothing worse.
 */
export const RUNNER_LINK_CLOSE_REASONS = Object.freeze({
  /**
   * On `UNPAIRED`: the owner also asked for the machine to be cleaned up. The
   * runner closes every session as well as stopping it — worktrees and session
   * folders removed, nothing pushed — instead of keeping the checkouts.
   */
  WIPE: 'host-unpaired-wipe',
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

/**
 * The largest transcript entry `attachment.chat` carries. The runner compacts
 * each line of the agent's transcript before it sends it — a tool's output and
 * a file it wrote are cut, an image goes as a preview in the room the entry
 * has left, or is only named — and drops an entry still bigger than this.
 */
export const CHAT_ENTRY_MAX_BYTES = 64 * 1024;

/** The most entries one `attachment.chat` holds; a longer history is several. */
export const CHAT_BATCH_MAX_ENTRIES = 256;

/** What the reader can do to a session's device from the console (`device.input`). */
export const DEVICE_INPUT_KINDS = ['tap', 'swipe', 'text', 'key', 'button'] as const;
export const DEVICE_KEYS = ['enter', 'backspace', 'escape', 'tab'] as const;
export const DEVICE_BUTTONS = ['home', 'back', 'appSwitch'] as const;
