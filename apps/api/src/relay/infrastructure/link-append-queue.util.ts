import type { EventsAppendMessage } from '@oppenheimer/shared/protocol';

/** Consecutive batches for one session, applied as one append. Never empty. */
export type AppendRun = [EventsAppendMessage, ...EventsAppendMessage[]];

/**
 * What the queue does to the socket under it. The queue decides when; the
 * gateway owns the socket.
 */
export interface AppendQueueFlow {
  /** Stop reading the socket: the runner's writes back up into TCP. */
  pause(): void;
  resume(): void;
  /** Give up on the link: close it with 1013 so the runner redials and resends. */
  overflow(reason: 'queue_full' | 'paused_too_long'): void;
}

export interface AppendQueueLimits {
  /** Pause the socket once this many batches are waiting. */
  pauseAt: number;
  /** Resume it once the waiting batches are down to this many. */
  resumeAt: number;
  /** Close the link once this many are waiting, paused or not. */
  closeAt: number;
  /** Close the link when a pause has lasted this long. */
  maxPauseMs: number;
  /** The most events one coalesced append takes: the protocol's own batch cap. */
  maxEventsPerAppend: number;
}

/**
 * One link's `events.append` messages, applied **in arrival order** by one
 * worker, with a bound.
 *
 * A session's log is ordered by the `seq` this control plane assigns on append,
 * and a runner sends a start's steps as consecutive batches; taken
 * concurrently, two appends race for the row lock and `running` can land after
 * `done`. So a link's appends go through here, one after another. Only appends
 * do: every other message runs on its own, so a credential ask never queues
 * behind the log — which is also why a run can only ever be cut short by
 * another session, since nothing of another type is in the queue to stop it.
 *
 * **Coalescing.** When the worker takes a batch it also takes every batch
 * queued right behind it for the same session, up to `maxEventsPerAppend`
 * events, and applies them as one append — one lock, one `INSERT` — which is
 * what makes the batched insert pay off for a runner that sends one event per
 * batch. The first batch for another session ends the run, so the order across
 * sessions is still the order they arrived in.
 *
 * **Backpressure.** The queue is bounded rather than trusted: at `pauseAt`
 * waiting batches the socket is paused, so the runner's writes back up into
 * its own bounded queue (its unacked batches stay in memory there, and are
 * resent on the next link); at `resumeAt` it reads again. Frames the socket had
 * already read still arrive while paused, so `closeAt` is the hard ceiling, and
 * a pause that outlasts `maxPauseMs` closes the link too — the runner treats
 * any close but 4410 as a reconnect and resends every unacked batch after its
 * hello, so nothing durable is lost.
 */
export class LinkAppendQueue {
  private readonly pending: EventsAppendMessage[] = [];
  private running = false;
  private closed = false;
  private pausedAt: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly apply: (run: AppendRun) => Promise<void>,
    private readonly flow: AppendQueueFlow,
    private readonly limits: AppendQueueLimits,
  ) {}

  /** Batches waiting, not counting the run being applied. */
  get size(): number {
    return this.pending.length;
  }

  get paused(): boolean {
    return this.pausedAt !== null;
  }

  push(message: EventsAppendMessage): void {
    if (this.closed) return;
    this.pending.push(message);
    if (this.pending.length >= this.limits.closeAt) {
      this.giveUp('queue_full');
      return;
    }
    if (!this.paused && this.pending.length >= this.limits.pauseAt) {
      this.pausedAt = setTimeout(() => this.giveUp('paused_too_long'), this.limits.maxPauseMs);
      this.pausedAt.unref?.();
      this.flow.pause();
    }
    void this.drain();
  }

  /** The link is gone: drop what is waiting and stop. The runner resends it. */
  dispose(): void {
    this.closed = true;
    this.pending.length = 0;
    this.clearPause();
  }

  private giveUp(reason: 'queue_full' | 'paused_too_long'): void {
    if (this.closed) return;
    this.dispose();
    this.flow.overflow(reason);
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (!this.closed && this.pending.length > 0) {
        const run = this.takeRun();
        if (this.paused && this.pending.length <= this.limits.resumeAt) {
          this.clearPause();
          this.flow.resume();
        }
        try {
          await this.apply(run);
        } catch {
          // `apply` logs its own failures; one bad run must not stall the link.
        }
      }
    } finally {
      this.running = false;
    }
  }

  /** The next batch, and every batch right behind it for the same session that fits. */
  private takeRun(): AppendRun {
    const first = this.pending.shift() as EventsAppendMessage;
    const run: AppendRun = [first];
    let events = first.events.length;
    for (let next = this.pending[0]; next; next = this.pending[0]) {
      if (next.sessionId !== first.sessionId) break;
      if (events + next.events.length > this.limits.maxEventsPerAppend) break;
      run.push(this.pending.shift() as EventsAppendMessage);
      events += next.events.length;
    }
    return run;
  }

  private clearPause(): void {
    if (this.pausedAt === null) return;
    clearTimeout(this.pausedAt);
    this.pausedAt = null;
  }
}
