/**
 * The queues the outbox relay delivers `queue` rows to, keyed by name: a
 * `ReadonlyMap<string, Queue>` of the registrations in `QueueModule` marked
 * `stagedOnOutbox`.
 */
export const OUTBOX_QUEUES = Symbol('OUTBOX_QUEUES');

/**
 * The outbox-fed queues that keep one pending job per aggregate: a
 * `ReadonlySet<string>` of the registrations in `QueueModule` marked
 * `onePendingPerAggregate`.
 */
export const OUTBOX_ONE_PENDING_PER_AGGREGATE = Symbol('OUTBOX_ONE_PENDING_PER_AGGREGATE');
