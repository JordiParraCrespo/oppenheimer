import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Send an Oppenheimer bot's answer in the owner's chat with the linked number
 * it answers on (`product/next-steps/answering-on-telegram-and-whatsapp.md`
 * §4): the reply to the owner's own message, quoting it, not a tool's send,
 * so it asks nothing and counts against no daily limit (only the host's own
 * send budget).
 */
export class ReplyOnWhatsappCommand extends CommandBase {
  readonly organizationId: string;
  readonly accountId: string;
  /** The owner's chat, as its JID. */
  readonly chatId: string;
  /** The stored `whatsapp_message` row it answers, quoted; null to send it on its own. */
  readonly replyToRowId: string | null;
  readonly text: string;
  /** The Oppenheimer bot that wrote it: it must still be the chat's bot. */
  readonly botId: string;

  constructor(props: CommandProps<ReplyOnWhatsappCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.accountId = props.accountId;
    this.chatId = props.chatId;
    this.replyToRowId = props.replyToRowId;
    this.text = props.text;
    this.botId = props.botId;
  }
}
