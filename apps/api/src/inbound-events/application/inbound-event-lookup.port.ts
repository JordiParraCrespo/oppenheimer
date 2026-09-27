import type { Option } from 'oxide.ts';
import type { StoredExternalEvent } from '../domain/external-event.types';

export interface RecentEventsQuery {
  organizationId: string;
  source: string;
  eventType: string;
  subjectRefs: readonly string[];
  since: Date;
  /** A ceiling on rows read; a preview counts within it. */
  limit: number;
}

/**
 * What the hub publishes to its consumers: an event by id — a run's cause, and
 * the untrusted context its prompt carries — and the recent events of a type on
 * some subjects, which is what the editor's "would have run N times" replays.
 * Workspace-scoped by argument: the consumer has already decided whose events
 * it is asking about.
 */
export interface InboundEventLookupPort {
  findOne(organizationId: string, id: string): Promise<Option<StoredExternalEvent>>;
  findRecent(query: RecentEventsQuery): Promise<StoredExternalEvent[]>;
}
