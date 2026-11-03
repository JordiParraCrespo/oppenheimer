/**
 * How a session's chat reads the history the runner sends, which nothing on
 * the wire marks the end of: whether a first load is still arriving, and how
 * long a quiet means nothing more is coming. The runner's batch sizes are
 * known here and nowhere else in the chat.
 */

import { CHAT_BATCH_MAX_ENTRIES, CHAT_ENTRY_MAX_BYTES } from '@oppenheimer/shared/protocol';

/** A batch as the history reads it: its reset, and its lines as sent. */
interface HistoryBatch {
  reset?: boolean;
  entries: readonly string[];
}

/**
 * How long a reconnect's replay may go quiet, short of the lines the chat
 * holds, before those it did not send again are taken as gone: well past
 * the runner's 300ms between reads of a long history.
 */
export const REPLAY_SETTLE_MS = 3000;

/**
 * How long a first load's history may go quiet before it is taken as all
 * there: past the runner's 300ms between reads of a long transcript.
 */
export const LOAD_SETTLE_MS = 500;

/**
 * Whether a batch is the last of a read of the transcript: the runner fills
 * a batch to `CHAT_BATCH_MAX_ENTRIES` entries or about 128KB, so one under
 * both, by entries and by a full entry's size, is all that read had.
 */
function endsARead(batch: HistoryBatch): boolean {
  if (batch.entries.length >= CHAT_BATCH_MAX_ENTRIES) return false;
  let bytes = 0;
  for (const entry of batch.entries) bytes += entry.length;
  return bytes < CHAT_ENTRY_MAX_BYTES;
}

/**
 * Whether a first load is still arriving once `batch` has landed. One starts
 * with a history that arrives where nothing is held yet (a reconnect's replay
 * of what is held is not one), and ends with the batch that ends a read; the
 * quiet after a batch ends it too, which the chat watches for.
 */
export function loadingAfter(
  loading: boolean,
  batch: HistoryBatch,
  holdsNothing: boolean,
): boolean {
  const starts = batch.reset === true && batch.entries.length > 0 && holdsNothing;
  return (loading || starts) && !endsARead(batch);
}

/** One quiet to wait out at a time: each `watch` replaces the last. */
export class Quiet {
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** Calls `done` once `ms` pass with no other `watch`; `null` waits for nothing. */
  watch(ms: number | null, done: () => void): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer =
      ms === null
        ? null
        : setTimeout(() => {
            this.timer = null;
            done();
          }, ms);
  }
}
