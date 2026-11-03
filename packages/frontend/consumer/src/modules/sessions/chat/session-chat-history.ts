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
 * How much of a first load may arrive before a short batch stops meaning the
 * history is all there. The runner reads a transcript 4MB at a time, 300ms
 * apart, and ends each read on a short batch; under this much received, no
 * read can have been cut there, so a short batch is the end and the chat
 * draws at once. Past it, only the quiet after the last read is. It is a
 * quarter of a read because the runner compacts lines before it sends them.
 */
const ONE_READ_BYTES = 1024 * 1024;

/** A batch's size as the runner counts it. */
function sizeOf(batch: HistoryBatch): number {
  let bytes = 0;
  for (const entry of batch.entries) bytes += utf8Length(entry);
  return bytes;
}

/**
 * Whether a batch is the last of a read of the transcript: the runner fills
 * a batch to `CHAT_BATCH_MAX_ENTRIES` entries or about 128KB, so one under
 * both, by entries and by a full entry's size, is all that read had.
 */
function endsARead(batch: HistoryBatch, bytes: number): boolean {
  return batch.entries.length < CHAT_BATCH_MAX_ENTRIES && bytes < CHAT_ENTRY_MAX_BYTES;
}

/** A line's size as the runner counts it, in UTF-8 bytes rather than UTF-16 units. */
function utf8Length(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit < 0x80) bytes += 1;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff) {
      // A surrogate pair is one code point of four bytes.
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

/**
 * A first load: a history that arrives where nothing is held yet (a
 * reconnect's replay of what is held is not one), held back until it has
 * all come. A short history ends on the batch that ends its one read; a
 * longer one, which the runner sends over several reads, on the quiet after
 * the last, which the chat watches for and ends with `end`.
 */
export class FirstLoad {
  /** The history is still arriving. */
  loading = false;
  private received = 0;

  /** Reads one batch of the history; `holdsNothing` when the chat has no line yet. */
  take(batch: HistoryBatch, holdsNothing: boolean): void {
    if (batch.reset === true && batch.entries.length > 0 && holdsNothing) {
      this.loading = true;
      this.received = 0;
    }
    if (!this.loading) return;
    const bytes = sizeOf(batch);
    this.received += bytes;
    if (endsARead(batch, bytes) && this.received < ONE_READ_BYTES) this.loading = false;
  }

  end(): void {
    this.loading = false;
  }
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
