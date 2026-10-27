import { ATTACHMENT_CREDIT_WINDOW_BYTES } from '@oppenheimer/shared/protocol';

/**
 * One attachment's credit, as its sender sees it: bytes sent minus bytes the
 * other side said it consumed, against the link's one window
 * (`ATTACHMENT_CREDIT_WINDOW_BYTES`). The control plane's counterpart of the
 * runner's `flowWindow` (`apps/runner/internal/cli/flow.go`), with the same
 * three moves: `acquire` before sending (waits while the window is spent),
 * `sent`, and `credit` when an `attachment.credit` arrives. `close` releases
 * every waiter with the reason.
 */
export class CreditWindow {
  private inFlight = 0;
  private closedWith: Error | null = null;
  private waiters: { resolve: () => void; reject: (error: Error) => void }[] = [];

  /** The bytes that may be sent now without waiting. */
  get room(): number {
    return Math.max(0, ATTACHMENT_CREDIT_WINDOW_BYTES - this.inFlight);
  }

  /** Waits until at least one byte of window is free; rejects once closed. */
  acquire(): Promise<void> {
    if (this.closedWith) return Promise.reject(this.closedWith);
    if (this.room > 0) return Promise.resolve();
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }

  sent(bytes: number): void {
    this.inFlight += bytes;
  }

  credit(bytes: number): void {
    this.inFlight = Math.max(0, this.inFlight - bytes);
    if (this.room === 0) return;
    for (const waiter of this.waiters.splice(0)) waiter.resolve();
  }

  close(reason: Error): void {
    this.closedWith ??= reason;
    for (const waiter of this.waiters.splice(0)) waiter.reject(reason);
  }
}
