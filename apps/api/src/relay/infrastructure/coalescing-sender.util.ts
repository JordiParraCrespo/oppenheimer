import { ATTACHMENT_CREDIT_WINDOW_BYTES } from '@oppenheimer/shared/protocol';
import type { RunnerLink } from '../../links/application/link-registry.port';

const MILLI = 1_000;

/**
 * One attachment's stream of one kind of control frame (its credit, its
 * resizes) onto the runner link, held to a rate. Frames within the budget go
 * out at once, so a pane's flow control is never slowed while it behaves; past
 * it, they are merged into one pending frame that goes out when the budget
 * refills. Merging rather than dropping is what keeps a credit from being
 * lost (a lost credit stalls its pane for good) and keeps the last size the
 * browser asked for.
 *
 * Every browser shares its host's one link, and the link is closed at 8 MiB
 * buffered (`LINK_MAX_BUFFERED_BYTES`): without this, one socket sending
 * `resize` or `credit` as fast as it can (a read-only guest included) fills
 * the buffer and takes down every other terminal on the host.
 */
export class CoalescingSender<T> {
  /** In thousandths of a frame, so the refill is integer milliseconds × the rate, exactly. */
  private milliTokens: number;
  private refilledAt = Date.now();
  private pending: T | null = null;
  private timer: NodeJS.Timeout | null = null;
  private disposed = false;

  constructor(
    private readonly options: {
      /** Frames that may go out back to back. */
      burst: number;
      /** Frames per second once the burst is spent. */
      perSecond: number;
      /** Fold a frame into the one still waiting. */
      merge: (pending: T, next: T) => T;
      send: (value: T) => void;
    },
  ) {
    this.milliTokens = options.burst * MILLI;
  }

  push(value: T): void {
    if (this.disposed) return;
    if (this.pending !== null) {
      this.pending = this.options.merge(this.pending, value);
      return;
    }
    if (this.take()) {
      this.options.send(value);
      return;
    }
    this.pending = value;
    this.schedule();
  }

  /** Forget what is waiting: the attachment it was for is gone. */
  dispose(): void {
    this.disposed = true;
    this.pending = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private take(): boolean {
    const now = Date.now();
    // A rate in frames per second refills that many thousandths per millisecond.
    const refill = (now - this.refilledAt) * this.options.perSecond;
    this.milliTokens = Math.min(this.options.burst * MILLI, this.milliTokens + refill);
    this.refilledAt = now;
    if (this.milliTokens < MILLI) return false;
    this.milliTokens -= MILLI;
    return true;
  }

  private schedule(): void {
    const waitMs = Math.ceil((MILLI - this.milliTokens) / this.options.perSecond);
    this.timer = setTimeout(() => this.flush(), Math.max(1, waitMs));
    this.timer.unref();
  }

  private flush(): void {
    this.timer = null;
    if (this.disposed || this.pending === null) return;
    if (!this.take()) {
      this.schedule();
      return;
    }
    const value = this.pending;
    this.pending = null;
    this.options.send(value);
  }
}

/**
 * The most one credit frame may carry onto the link. A browser credits each
 * frame it drew: a PTY frame is at most 32 KiB, a device frame at most the
 * link's frame cap, which is two windows. The ceiling is two windows rather than one because
 * merged credits may legitimately add up past one (the runner reads a frame
 * after its window has a byte free), and a merged sum cut short would shrink
 * that pane's window for good. The runner clamps what it has in flight at
 * zero, so the ceiling only bounds the number.
 */
export const MAX_CREDIT_BYTES = 2 * ATTACHMENT_CREDIT_WINDOW_BYTES;

/**
 * A browser credits once per frame it drew. A busy pane's frames are large (its
 * reads fill up), so it credits a few times per window; the burst absorbs a
 * screenful of small ones, so a behaving pane is rarely coalesced, and when it
 * is the credit is late by milliseconds, never lost.
 */
export const CREDIT_RATE = { burst: 64, perSecond: 200 } as const;

/** A drag of the window edge is a resize per animation frame; the last one wins. */
export const RESIZE_RATE = { burst: 8, perSecond: 20 } as const;

export function clampCredit(bytes: number): number {
  return Math.min(bytes, MAX_CREDIT_BYTES);
}

/**
 * An attachment's credit onto the link, as `attachment.credit` under the id it
 * holds when the credit goes out (none once it detached): summed while it waits,
 * and clamped.
 */
export function attachmentCreditSender(
  link: RunnerLink,
  attachmentId: () => number | null,
): CoalescingSender<number> {
  return new CoalescingSender({
    ...CREDIT_RATE,
    merge: (pending, next) => clampCredit(pending + next),
    send: (bytes) => {
      const id = attachmentId();
      if (id === null) return;
      link.send({ type: 'attachment.credit', attachmentId: id, bytes });
    },
  });
}
