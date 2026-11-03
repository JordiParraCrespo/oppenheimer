import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a session's runner logged that its agent asked to be woken at
 * a time (`wake.requested`, `product/next-steps/agent-tools.md` §4). It
 * carries the agent's own words for itself, which the wake types back into
 * the session when the time comes.
 */
export class SessionWakeRequestedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly wakeId: string;
  /** When to wake it, ISO 8601. */
  readonly at: string;
  readonly text: string;

  constructor(props: DomainEventProps<SessionWakeRequestedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.wakeId = props.wakeId;
    this.at = props.at;
    this.text = props.text;
  }
}
