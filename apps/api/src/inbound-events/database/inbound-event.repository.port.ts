import type { Option } from 'oxide.ts';
import type { MatchingEvents, MatchingEventsQuery } from '../application/inbound-event-lookup.port';
import type {
  ExternalEvent,
  InboundDelivery,
  StoredExternalEvent,
} from '../domain/external-event.types';

export interface NewDelivery {
  source: string;
  deliveryId: string;
  eventName: string;
  payload: Record<string, unknown>;
  /** SHA-256 hex of the raw bytes the provider signed. */
  payloadDigest: string;
  /** The receiving command's correlation id, recorded on the processing job it stages. */
  correlationId: string;
}

export interface InboundEventRepositoryPort {
  /**
   * Store a delivery and stage the job that owes its processing, in one
   * transaction. `false` when the provider retried a delivery already stored,
   * or when the same signed bytes arrive again under another delivery id (a
   * replay): nothing is written and nothing is owed twice.
   */
  receive(delivery: NewDelivery): Promise<boolean>;

  findDelivery(id: string): Promise<Option<InboundDelivery>>;

  /**
   * Store a delivery's events for each workspace, stage one
   * `ExternalEventReceived` per event that landed, and mark the delivery
   * processed — together. An event already stored (re-processing) is skipped,
   * and so is its notification.
   *
   * Returns how many events were **newly stored** by this call (what the
   * outbox is woken for); the delivery's `eventCount` column is the **total**
   * stored for it, so a re-run neither resets nor inflates it.
   */
  recordProcessed(
    delivery: InboundDelivery,
    organizationIds: readonly string[],
    events: readonly ExternalEvent[],
  ): Promise<number>;

  markFailed(deliveryId: string, error: string): Promise<void>;

  /**
   * The sweep: re-stage the processing of deliveries still `received` since
   * before `staleBefore` (their job ran out of retries, or Redis lost it), at
   * most once per `staleBefore` window each, and give up on those received
   * before `abandonBefore` — marked failed, where a replay can find them.
   */
  restageUnprocessed(
    staleBefore: Date,
    abandonBefore: Date,
    batch: number,
  ): Promise<{ restaged: number; abandoned: number }>;

  findOne(organizationId: string, id: string): Promise<Option<StoredExternalEvent>>;
  findMatching(query: MatchingEventsQuery): Promise<MatchingEvents>;

  /** Retention: batched deletes by age, each returning how many rows went. */
  deleteDeliveriesBefore(cutoff: Date, batch: number): Promise<number>;
  deleteEventsBefore(cutoff: Date, batch: number): Promise<number>;
}
