import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a session row exists and its first log entry is written.
 *
 * Carries the host and the project because everything downstream — dispatching
 * the job, showing the row, deciding whose workspace owes the work — needs those
 * two without re-reading the aggregate.
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
