import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * The confirmed owner wrote to their linked number from their own, and
 * `botId` answers that chat at their message
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md`): a turn for
 * it, a fresh conversation (`new`), or the running turn stopped (`stop`).
 * Dispatched once per stored message.
 */
export class WakeOnWhatsappCommand extends CommandBase {
  readonly organizationId: string;
  /** The person who linked the number; the bot answers only its own maker. */
  readonly userId: string;
  /** The chat's bot at the message: the last switch's by name, or the number's default. */
  readonly botId: string;
  readonly whatsappAccountId: string;
  /** The owner's direct chat with the number, as its JID. */
  readonly chatId: string;
  /** The stored `whatsapp_message` row: the turn's key, and what the reply quotes. */
  readonly messageRowId: string;
  /** Its `whatsapp_message.seq`: where it falls in the chat. */
  readonly seq: string;
  /** The seq of the chat's last `/new` or switch at or before it, '0' for neither. */
  readonly conversationStartsAt: string;
  readonly command: 'message' | 'new' | 'stop';
  readonly text: string;

  constructor(props: CommandProps<WakeOnWhatsappCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.botId = props.botId;
    this.whatsappAccountId = props.whatsappAccountId;
    this.chatId = props.chatId;
    this.messageRowId = props.messageRowId;
    this.seq = props.seq;
    this.conversationStartsAt = props.conversationStartsAt;
    this.command = props.command;
    this.text = props.text;
  }
}
