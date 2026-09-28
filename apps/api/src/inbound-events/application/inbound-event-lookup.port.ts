import type { Option } from 'oxide.ts';
import type { StoredExternalEvent } from '../domain/external-event.types';

export interface MatchingEventsQuery {
  organizationId: string;
  source: string;
  eventType: string;
  subjectRefs: readonly string[];
  since: Date;
  /**
   * The attribute a trigger's filter narrows on and the value it wants —
   * equal, or among the values when the attribute is a list (labels) — the
   * same rule as `matchesTriggerFilter`. Absent matches every event.
   */
  attribute?: { field: string; value: string };
  /** How many of the newest matches to return beside the count. */
  sampleSize: number;
}

/** Every match counted, and the newest few to show. */
export interface MatchingEvents {
  count: number;
  sample: StoredExternalEvent[];
}

/**
 * What the hub publishes to its consumers: an event by id — a run's cause, and
 * the untrusted context its prompt carries — and the recent events of a type on
 * some subjects, which is what the editor's "would have run N times" replays.
 * Workspace-scoped by argument: the consumer has already decided whose events
 * it is asking about. Events our own App caused are never matches: they never
 * fire anything.
 */
export interface InboundEventLookupPort {
  findOne(organizationId: string, id: string): Promise<Option<StoredExternalEvent>>;
  findMatching(query: MatchingEventsQuery): Promise<MatchingEvents>;
}
