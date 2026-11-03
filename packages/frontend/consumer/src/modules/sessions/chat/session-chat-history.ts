/**
 * How a session's chat reads the history the runner sends: whether a first
 * load is still arriving, and how long a quiet means nothing more is coming.
 * A runner says where its history ends (`history` on each batch); for one
 * that does not, the end is inferred from its batch sizes, which are known
 * here and nowhere else in the chat.
 */

import { CHAT_BATCH_MAX_ENTRIES, CHAT_ENTRY_MAX_BYTES } from '@oppenheimer/shared/protocol';

/** A batch as the history reads it: its reset, where the history stands, and its lines as sent. */
interface HistoryBatch {
  reset?: boolean;
  history?: 'more' | 'end';
  entries: readonly string[];
}

/**
 * How long a reconnect's replay may go quiet, short of the lines the chat
 * holds, before those it did not send again are taken as gone: well past
 * the runner's 300ms between reads of a long history.
 */
const REPLAY_SETTLE_MS = 3000;

/**
 * How long a first load's history may go quiet before it is taken as all
 * there: past the runner's 300ms between reads of a long transcript.
 */
const LOAD_SETTLE_MS = 500;

/**
 * How long a history whose runner says where it ends may go quiet before it
 * is taken as all there anyway: only a runner that stopped partway, since a
 * slow read is told apart from the end by the runner itself. Well past a
 * read of 4MB of screenshots, each a preview to make.
 */
const TOLD_SETTLE_MS = 15_000;

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
 * all come.
 *
 * A runner that says where its history ends is believed: `more` holds it,
 * `end` lets it go. One that does not reads a transcript 4MB at a time,
 * 300ms apart, and ends every read on a short batch, so a short batch says
 * only that a read ended. A first batch that is short is the exception: a
 * read that fills less than one batch is shorter than 4MB, so it stopped at
 * the end of the file, and the history is all there. Any longer history
 * ends on the quiet after its last read, which the chat watches for and
 * ends with `end`.
 */
export class FirstLoad {
  /** The history is still arriving. */
  loading = false;
  /** The runner says where the history it is sending ends. */
  told = false;

  /** Reads one batch of the history; `holdsNothing` when the chat has no line yet. */
  take(batch: HistoryBatch, holdsNothing: boolean): void {
    if (batch.reset === true) this.told = batch.history !== undefined;
    if (batch.history === 'end') {
      this.loading = false;
      return;
    }
    if (batch.reset !== true || !holdsNothing) return;
    if (batch.history === 'more') this.loading = true;
    else if (batch.entries.length > 0) this.loading = !endsARead(batch, sizeOf(batch));
  }

  end(): void {
    this.loading = false;
  }

  /**
   * How long a quiet now would mean the history has all come, `replaying`
   * when a reconnect's replay has not yet sent every line held; `null` for
   * nothing to wait on.
   */
  settleAfter(replaying: boolean): number | null {
    if (this.loading) return this.told ? TOLD_SETTLE_MS : LOAD_SETTLE_MS;
    if (!replaying) return null;
    return this.told ? TOLD_SETTLE_MS : REPLAY_SETTLE_MS;
  }
}

/**
 * Whether a reset has lines to come: the start of a replay of what is held,
 * not a transcript that is empty now. A reset with no lines yet whose
 * runner says more is coming is one.
 */
export function linesToCome(batch: HistoryBatch): boolean {
  return batch.entries.length > 0 || batch.history === 'more';
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
