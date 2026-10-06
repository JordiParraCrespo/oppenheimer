import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a run is written in a new outcome: queued, skipped, expired,
 * deferred or dispatched. Running and finished are its session's to say.
 */
export class AutomationRunChangedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly automationId: string;

  constructor(props: DomainEventProps<AutomationRunChangedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.automationId = props.automationId;
  }
}
