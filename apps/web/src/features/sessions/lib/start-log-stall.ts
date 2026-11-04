import { CONSUMER_CONFIG } from '@oppenheimer/frontend-consumer/config';

/** What {@link startLogStallDeadline} reads off the start log's query. */
export interface StartLogReadState {
  error: unknown;
  /** When the last read succeeded; 0 for a log the create seeded and nobody read yet. */
  dataUpdatedAt: number;
}

/**
 * When a failing start log becomes worth telling the reader about, or `null`
 * while nothing is failing. A failed read over steps already drawn is a blip
 * while the poll keeps going, and "Could not reach the server" over a stepper
 * that goes on ticking is wrong more often than right; so the pane says it
 * only once `CONSUMER_CONFIG.sessions.startLogStallMs` has passed since the
 * last read that worked, or since the pane began watching when none has.
 *
 * A deadline rather than a comparison of read times: while the workspace
 * stream covers the log, nothing polls it, so a failed read may be the last
 * read for a while and only a clock can say the grace has run out.
 */
export function startLogStallDeadline(
  read: StartLogReadState,
  watchingSince: number,
): number | null {
  if (!read.error) return null;
  return Math.max(read.dataUpdatedAt, watchingSince) + CONSUMER_CONFIG.sessions.startLogStallMs;
}
