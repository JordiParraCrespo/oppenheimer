import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a person's mark on an Inbox item is set or removed. Their other
 * tabs re-read their marks (`inboxMark.changed`), so two tabs stay in step.
 */
export class InboxMarkChangedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly userId: string;
  readonly itemKey: string;

  constructor(props: DomainEventProps<InboxMarkChangedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.itemKey = props.itemKey;
  }
}
