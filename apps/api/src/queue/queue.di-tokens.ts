/**
 * The queues the outbox relay delivers `queue` rows to, keyed by name: a
 * `ReadonlyMap<string, Queue>` of the registrations in `QueueModule` marked
 * `stagedOnOutbox`.
 */
export const OUTBOX_QUEUES = Symbol('OUTBOX_QUEUES');
