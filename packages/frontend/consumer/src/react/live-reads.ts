import type { LiveEvent } from '@oppenheimer/shared/live';
import type { QueryKey } from '@tanstack/react-query';
import { sessionsKeys } from './sessions.queries';

type ReadsOf<T extends LiveEvent['type']> = {
  /** The reads one event of this type makes stale. */
  reads(event: Extract<LiveEvent, { type: T }>): QueryKey[];
  /** Every read this type can reach: what is read again whenever the stream comes up. */
  covers: QueryKey[];
};

/**
 * What each live event refreshes. A new event type is a row here, and the
 * stream's hook stays start, stop and deliver
 * (`product/versions/mvp/21-live-events.md`).
 */
const LIVE_READS: { [T in LiveEvent['type']]: ReadsOf<T> } = {
  'session.changed': {
    reads: (event) => [sessionsKeys.detail(event.sessionId), sessionsKeys.lists()],
    covers: [sessionsKeys.all],
  },
};

export function readsOf(event: LiveEvent): QueryKey[] {
  return (LIVE_READS[event.type] as ReadsOf<LiveEvent['type']>).reads(event);
}

/** Every read the stream carries, for the catch-up when it comes up. */
export const LIVE_COVERED: QueryKey[] = Object.values(LIVE_READS).flatMap((type) => type.covers);
