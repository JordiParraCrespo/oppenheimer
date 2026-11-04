import { CONSUMER_CONFIG } from '@oppenheimer/frontend-consumer/config';

/** What {@link startLogStalled} reads off the start log's query. */
export interface StartLogReadState {
  error: unknown;
  /** When the last read failed. */
  errorUpdatedAt: number;
  /** When the last read succeeded; 0 for a log the create seeded and nobody read yet. */
  dataUpdatedAt: number;
}

/**
 * Whether the start log has gone unread long enough to tell the reader. A
 * failed read over steps already drawn is a blip while the poll keeps going,
 * and "Could not reach the server" over a stepper that goes on ticking is
 * wrong more often than right; so the pane says it only once reads have
 * failed for `CONSUMER_CONFIG.sessions.startLogStallMs` since the last one that worked, or
 * since the pane began watching when none has.
 */
export function startLogStalled(read: StartLogReadState, watchingSince: number): boolean {
  if (!read.error) return false;
  return (
    read.errorUpdatedAt - Math.max(read.dataUpdatedAt, watchingSince) >=
    CONSUMER_CONFIG.sessions.startLogStallMs
  );
}
