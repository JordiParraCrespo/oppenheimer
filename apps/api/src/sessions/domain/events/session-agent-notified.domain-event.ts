import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a session's agent sent a line (`runner sessions notify`,
 * `agent.notified` in the log, `product/next-steps/agent-tools.md` §2 and
 * §9). It carries the notice's id, never its words: whoever hears it (a bot
 * following the session) reads the session again and takes the notice it
 * holds, so a stale or redelivered event never speaks for a newer one.
 */
export class SessionAgentNotifiedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  /** The runner's id for the notice. */
  readonly noticeId: string;

  constructor(props: DomainEventProps<SessionAgentNotifiedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.noticeId = props.noticeId;
  }
}
