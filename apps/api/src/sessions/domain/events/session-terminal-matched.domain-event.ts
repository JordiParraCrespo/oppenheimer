import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a session's runner reported that a terminal watch's pattern
 * matched lines it had not matched before (`terminal.matched` in the log).
 * It carries the watch and the cumulative count, never the matched text:
 * that stays on the host. Whoever asked for the watch (a bot's subscription,
 * `27-bot-subscriptions.md` §2) hears it here.
 */
export class SessionTerminalMatchedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly watchId: string;
  /** How many new matching lines the runner has counted for this watch so far. */
  readonly count: number;

  constructor(props: DomainEventProps<SessionTerminalMatchedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.watchId = props.watchId;
    this.count = props.count;
  }
}
