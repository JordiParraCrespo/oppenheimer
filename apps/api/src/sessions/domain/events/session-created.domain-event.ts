import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a session row exists and its first log entry is written.
 *
 * Carries the host and the project so a consumer need not re-read the aggregate
 * for them. Nothing subscribes yet: the create handler dispatches the job itself.
 */
export class SessionCreatedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly projectId: string;
  readonly hostId: string;
  readonly slug: string;
  readonly agent: string;

  constructor(props: DomainEventProps<SessionCreatedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.projectId = props.projectId;
    this.hostId = props.hostId;
    this.slug = props.slug;
    this.agent = props.agent;
  }
}
