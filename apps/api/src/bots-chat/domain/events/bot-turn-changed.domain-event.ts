import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';
import type { BotTurnStatus } from '@oppenheimer/shared';

/**
 * Raised when a turn is queued or ends: the two moments a bot can start or
 * stop working. The workspace stream announces it, so the sidebar's working
 * bots move without a poll. A queued turn starting is neither, and raises nothing.
 */
export class BotTurnChangedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly botId: string;
  readonly status: BotTurnStatus;

  constructor(props: DomainEventProps<BotTurnChangedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.botId = props.botId;
    this.status = props.status;
  }
}
