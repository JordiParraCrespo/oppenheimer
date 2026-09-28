import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';
import type { TurnOrigin, TurnState } from '../session-turn.policy';

/**
 * Raised when a session's turn moved state — opened, started, waiting, or
 * ended. It is how a consumer that owns a turn's *reason* (an automation's run,
 * a Slack thread later) hears that the work finished, without reading this
 * module's tables.
 */
export class SessionTurnChangedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly turn: number;
  readonly origin: TurnOrigin;
  readonly from: TurnState | null;
  readonly to: TurnState;

  constructor(props: DomainEventProps<SessionTurnChangedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.turn = props.turn;
    this.origin = props.origin;
    this.from = props.from;
    this.to = props.to;
  }
}
