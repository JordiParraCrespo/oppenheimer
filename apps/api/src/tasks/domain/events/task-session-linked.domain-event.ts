import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * A session was attached to a task, started from it or linked to it. The one
 * fact about a task another module is expected to care about; nothing listens
 * yet.
 */
export class TaskSessionLinkedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly sessionId: string;
  readonly origin: 'started' | 'linked';

  constructor(props: DomainEventProps<TaskSessionLinkedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.sessionId = props.sessionId;
    this.origin = props.origin;
  }
}
