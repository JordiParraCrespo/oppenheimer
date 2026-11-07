import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { BOT_NOTICE_TEXT_MAX } from '@oppenheimer/shared';
import { BotNoticeChangedDomainEvent } from './events/bot-notice-changed.domain-event';

export interface BotNoticeProps {
  organizationId: string;
  botId: string;
  /** The line, trimmed: what the Inbox shows. */
  text: string;
}

/**
 * A line a bot sent the person (`notify`, `product/next-steps/agent-tools.md`
 * §5). A bot keeps one, its latest: a new notice takes the place of the last
 * under an id of its own, so the Inbox's mark on the last never hides it.
 */
export class BotNoticeEntity extends AggregateRoot<BotNoticeProps> {
  static create(create: CreateEntityProps<BotNoticeProps>): BotNoticeEntity {
    return new BotNoticeEntity(create);
  }

  /** A new notice from the bot, announced to its workspace. */
  static send(props: BotNoticeProps): BotNoticeEntity {
    const notice = new BotNoticeEntity({
      id: randomUUID(),
      props: { ...props, text: props.text.trim() },
    });
    notice.validate();
    notice.addEvent(
      new BotNoticeChangedDomainEvent({
        aggregateId: notice.id,
        organizationId: props.organizationId,
        botId: props.botId,
        reason: `bot ${props.botId}: sent notice ${notice.id}`,
      }),
    );
    return notice;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get botId(): string {
    return this.props.botId;
  }
  get text(): string {
    return this.props.text;
  }

  public validate(): void {
    const { props } = this;
    if (!props.organizationId || !props.botId) {
      throw new ArgumentNotProvidedException('A notice belongs to a bot');
    }
    if (!props.text || props.text.length > BOT_NOTICE_TEXT_MAX) {
      throw new ArgumentInvalidException(
        `A notice says its line in 1 to ${BOT_NOTICE_TEXT_MAX} characters`,
      );
    }
  }
}
