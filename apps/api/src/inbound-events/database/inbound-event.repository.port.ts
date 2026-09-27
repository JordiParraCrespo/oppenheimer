import type { Option } from 'oxide.ts';
import type { RecentEventsQuery } from '../application/inbound-event-lookup.port';
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
}

export interface InboundEventRepositoryPort {
  /**
   * Store a delivery and stage the job that owes its processing, in one
   * transaction. `false` when the provider retried a delivery already stored:
   * nothing is written and nothing is owed twice.
   */
  receive(delivery: NewDelivery): Promise<boolean>;

  findDelivery(id: string): Promise<Option<InboundDelivery>>;

  /**
   * Store a delivery's events for each workspace, stage one
   * `ExternalEventReceived` per event that landed, and mark the delivery
   * processed — together. An event already stored (re-processing) is skipped,
   * and so is its notification.
   */
  recordProcessed(
    delivery: InboundDelivery,
    organizationIds: readonly string[],
    events: readonly ExternalEvent[],
  ): Promise<number>;

  markFailed(deliveryId: string, error: string): Promise<void>;

  findOne(organizationId: string, id: string): Promise<Option<StoredExternalEvent>>;
  findRecent(query: RecentEventsQuery): Promise<StoredExternalEvent[]>;

  /** Retention: batched deletes by age, each returning how many rows went. */
  deleteDeliveriesBefore(cutoff: Date, batch: number): Promise<number>;
  deleteEventsBefore(cutoff: Date, batch: number): Promise<number>;
}
