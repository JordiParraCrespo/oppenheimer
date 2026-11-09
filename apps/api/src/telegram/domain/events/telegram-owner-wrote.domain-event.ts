import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * The owner of a Telegram bot wrote to it in their direct chat, and an
 * Oppenheimer bot answers there
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md`): raised once
 * per stored message, in the transaction that stored it. `command` is what
 * the message asks: a turn (`message`), a fresh conversation (`new`), or the
 * running turn to stop (`stop`). The aggregate is the Telegram account.
 */
export class TelegramOwnerWroteDomainEvent extends DomainEvent {
  readonly organizationId: string;
  /** The person who owns the Telegram bot: the turn is theirs. */
  readonly userId: string;
  readonly answeringBotId: string;
  readonly chatId: string;
  /** Telegram's id of the message, unique in its chat: what the reply answers. */
  readonly messageId: string;
  readonly command: 'message' | 'new' | 'stop';
  /** What they wrote; empty for a command. */
  readonly text: string;

  constructor(props: DomainEventProps<TelegramOwnerWroteDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.answeringBotId = props.answeringBotId;
    this.chatId = props.chatId;
    this.messageId = props.messageId;
    this.command = props.command;
    this.text = props.text;
  }
}
