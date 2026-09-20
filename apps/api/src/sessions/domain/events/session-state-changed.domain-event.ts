import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';
import type { SessionState } from '@oppenheimer/shared';

/**
 * Raised when the fold moved the stored lifecycle — never when a log entry
 * merely advanced `lastEventAt`.
 *
 * It carries both sides of the transition and the `stateSeq` that produced it, so
 * a consumer that sees two of these out of order can tell which is later without
 * a timestamp comparison.
 */
export class SessionStateChangedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly from: SessionState;
  readonly to: SessionState;
  readonly stateSeq: number;

  constructor(props: DomainEventProps<SessionStateChangedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.from = props.from;
    this.to = props.to;
    this.stateSeq = props.stateSeq;
  }
}
