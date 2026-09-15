import { randomUUID } from 'node:crypto';
import { ArgumentNotProvidedException } from './exceptions';
import { Guard } from './guard';
import { RequestContextService } from './request-context.service';

export interface DomainEventMetadata {
  /** Timestamp when this domain event occurred. */
  readonly timestamp: number;

  /** Correlation id (integration events, log correlation, etc). */
  readonly correlationId: string;

  /** Causation id used to reconstruct execution order if needed. */
  readonly causationId?: string;

  /** User id for debugging and logging purposes. */
  readonly userId?: string;
}

export type DomainEventProps<T> = Omit<T, 'id' | 'metadata'> & {
  aggregateId: string;
  reason?: string;
  metadata?: Partial<DomainEventMetadata>;
};

/**
 * Base class for domain events. Domain events are raised by aggregates to
 * signal that something significant happened in the domain, decoupling the
 * producer from any number of consumers.
 */
export abstract class DomainEvent {
  public readonly id: string;

  /** Aggregate id where the domain event occurred. */
  public readonly aggregateId: string;

  /**
   * Why this event's side effects are owed, in words. Recorded on the outbox
   * row so a queued item is self-explaining when someone opens the table.
   */
  public readonly reason?: string;

  public readonly metadata: DomainEventMetadata;

  constructor(props: DomainEventProps<unknown>) {
    if (Guard.isEmpty(props)) {
      throw new ArgumentNotProvidedException('DomainEvent props should not be empty');
    }
    this.id = randomUUID();
    this.aggregateId = props.aggregateId;
    this.reason = props.reason;
    this.metadata = {
      correlationId:
        props?.metadata?.correlationId ?? RequestContextService.getCorrelationId() ?? randomUUID(),
      causationId: props?.metadata?.causationId,
      timestamp: props?.metadata?.timestamp ?? Date.now(),
      userId: props?.metadata?.userId,
    };
  }
}
