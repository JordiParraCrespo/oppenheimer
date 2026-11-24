import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Put an Oppenheimer bot's reaction on a message in the chat it answers on a
 * linked number (the owner's own chat, or a chat the number allows), as the
 * number: the bot's gesture in the conversation it was already let answer,
 * so, like its reply, it asks nothing and counts against no daily limit
 * (only the host's own send budget). An empty emoji takes it back.
 */
export class ReactOnWhatsappCommand extends CommandBase {
  readonly organizationId: string;
  readonly accountId: string;
  /** The chat, as its JID: the owner's, or one the number allows. */
  readonly chatId: string;
  /** The stored `whatsapp_message` row reacted to. */
  readonly messageRowId: string;
  /** One emoji, or empty to take the reaction back. */
  readonly emoji: string;
  /** The Oppenheimer bot reacting: it must still be the chat's bot. */
  readonly botId: string;

  constructor(props: CommandProps<ReactOnWhatsappCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.accountId = props.accountId;
    this.chatId = props.chatId;
    this.messageRowId = props.messageRowId;
    this.emoji = props.emoji;
    this.botId = props.botId;
  }
}
