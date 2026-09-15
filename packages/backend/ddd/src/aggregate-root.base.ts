import { DomainEvent } from './domain-event.base';
import { Entity } from './entity.base';

/**
 * Aggregate roots are the only entities an outside caller may hold a reference
 * to. They guard the consistency boundary of the aggregate and collect domain
 * events to be published once the surrounding transaction commits.
 */
export abstract class AggregateRoot<EntityProps> extends Entity<EntityProps> {
  private _domainEvents: DomainEvent[] = [];

  get domainEvents(): DomainEvent[] {
    return this._domainEvents;
  }

  protected addEvent(domainEvent: DomainEvent): void {
    this._domainEvents.push(domainEvent);
  }

  public clearEvents(): void {
    this._domainEvents = [];
  }
}
