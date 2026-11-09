import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * The owner wrote to their Telegram bot, and `botId` answers there
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md`): a turn for
 * their message, a fresh conversation (`new`), or the running turn stopped
 * (`stop`). Dispatched once per stored message.
 */
export class WakeOnTelegramCommand extends CommandBase {
  readonly organizationId: string;
  /** The person who owns the Telegram bot; the bot answers only its own owner. */
  readonly userId: string;
  readonly botId: string;
  readonly telegramAccountId: string;
  readonly chatId: string;
  readonly messageId: string;
  /** The id of the owner's last `/new` at or before it, '0' for none. */
  readonly conversationStartsAt: string;
  readonly command: 'message' | 'new' | 'stop';
  readonly text: string;

  constructor(props: CommandProps<WakeOnTelegramCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.botId = props.botId;
    this.telegramAccountId = props.telegramAccountId;
    this.chatId = props.chatId;
    this.messageId = props.messageId;
    this.conversationStartsAt = props.conversationStartsAt;
    this.command = props.command;
    this.text = props.text;
  }
}
