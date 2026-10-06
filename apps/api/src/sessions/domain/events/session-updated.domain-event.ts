import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';
import type { SessionOrigin } from '../session-turn.policy';

/**
 * Raised once per committed write that landed log entries: the row a reader
 * sees may have moved, whatever the entries were (a start step, a stop, a
 * close request, a rename, a move, a checkout).
 *
 * It says that the session changed, never how; `SessionStateChanged` and
 * `SessionTurnChanged` carry the transitions. `origin` tells a consumer that
 * owns a session's reason (an automation's run) whether this one is its own,
 * without reading this module's tables.
 */
export class SessionUpdatedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly origin: SessionOrigin;

  constructor(props: DomainEventProps<SessionUpdatedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.origin = props.origin;
  }
}
