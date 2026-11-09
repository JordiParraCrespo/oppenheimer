import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * The confirmed owner of a linked number wrote to it from their own number,
 * and an Oppenheimer bot answers that chat
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md`): raised once
 * per stored message, in the transaction that stored it. `command` is what
 * the message asks: a turn (`message`), a fresh conversation (`new`), or the
 * running turn to stop (`stop`). The aggregate is the WhatsApp account.
 */
export class WhatsappOwnerWroteDomainEvent extends DomainEvent {
  readonly organizationId: string;
  /** The person who linked the number: the turn is theirs. */
  readonly userId: string;
  readonly accountId: string;
  /** The owner's direct chat with the number, as its JID. */
  readonly chatId: string;
  /** The stored `whatsapp_message` row: the turn's key, and what the reply quotes. */
  readonly messageRowId: string;
  /** Its `whatsapp_message.seq`: where it falls in the chat. */
  readonly seq: string;
  /**
   * The chat's bot at this message: the bot of the last switch by name at
   * or before it, or the number's default.
   */
  readonly botId: string;
  /**
   * The seq the message's conversation starts at: the later of the owner's
   * last `/new` and the last switch at or before it, '0' for neither.
   */
  readonly conversationStartsAt: string;
  /** Whether the conversation starts at this very message (a `/new`, or a switch with words). */
  readonly startsHere: boolean;
  readonly command: 'message' | 'new' | 'stop';
  /** What they wrote, without a switch's "Name:" prefix; empty for a command. */
  readonly text: string;

  constructor(props: DomainEventProps<WhatsappOwnerWroteDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.accountId = props.accountId;
    this.chatId = props.chatId;
    this.messageRowId = props.messageRowId;
    this.seq = props.seq;
    this.botId = props.botId;
    this.conversationStartsAt = props.conversationStartsAt;
    this.startsHere = props.startsHere;
    this.command = props.command;
    this.text = props.text;
  }
}
