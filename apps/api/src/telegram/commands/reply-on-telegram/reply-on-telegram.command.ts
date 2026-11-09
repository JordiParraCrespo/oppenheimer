import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Send an Oppenheimer bot's answer in a chat of the Telegram bot it answers
 * on (`product/next-steps/answering-on-telegram-and-whatsapp.md` §4): the
 * reply to the owner's own message, not a tool's send, so it asks nothing
 * and counts against no daily limit.
 */
export class ReplyOnTelegramCommand extends CommandBase {
  readonly organizationId: string;
  readonly accountId: string;
  readonly chatId: string;
  /** The message it answers; null to send it on its own. */
  readonly replyToId: string | null;
  readonly text: string;
  /** The Oppenheimer bot that wrote it: it must still be the one that answers here. */
  readonly botId: string;

  constructor(props: CommandProps<ReplyOnTelegramCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.accountId = props.accountId;
    this.chatId = props.chatId;
    this.replyToId = props.replyToId;
    this.text = props.text;
    this.botId = props.botId;
  }
}
