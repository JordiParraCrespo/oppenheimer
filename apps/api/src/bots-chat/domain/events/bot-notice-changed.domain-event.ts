import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a bot sends the person a notice (`notify`,
 * `product/next-steps/agent-tools.md` §5), in place of its last one. The
 * workspace stream announces it, so the Inbox shows it without a poll.
 */
export class BotNoticeChangedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly botId: string;

  constructor(props: DomainEventProps<BotNoticeChangedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.botId = props.botId;
  }
}
