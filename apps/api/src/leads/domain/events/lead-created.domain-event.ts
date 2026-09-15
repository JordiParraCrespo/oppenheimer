import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a lead enters the pipeline.
 *
 * Carries the scope keys so a listener can decide who to notify without
 * re-reading the row — and, importantly, without needing an access scope of its
 * own to do it.
 */
export class LeadCreatedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly teamId: string | null;
  readonly ownerId: string | null;

  constructor(props: DomainEventProps<LeadCreatedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.teamId = props.teamId;
    this.ownerId = props.ownerId;
  }
}
