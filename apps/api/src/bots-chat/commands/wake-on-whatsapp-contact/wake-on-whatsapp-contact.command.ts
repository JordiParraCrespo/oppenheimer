import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Someone who is not the owner spoke to a linked number in a chat it allows,
 * and `botId` answers that chat: a contact's turn for it. Dispatched once per
 * stored message.
 */
export class WakeOnWhatsappContactCommand extends CommandBase {
  readonly organizationId: string;
  /** The person who linked the number; only a bot they made answers on it. */
  readonly userId: string;
  /** The chat's bot: the one chosen for it, or the number's default. */
  readonly botId: string;
  readonly whatsappAccountId: string;
  /** The allowed chat, as its JID: a person's or a group's. */
  readonly chatId: string;
  readonly chatKind: 'direct' | 'group';
  readonly chatName: string | null;
  readonly senderId: string;
  readonly senderName: string | null;
  /** The stored `whatsapp_message` row: the turn's key, and what the reply quotes. */
  readonly messageRowId: string;
  /** Its `whatsapp_message.seq`: where it falls in the chat. */
  readonly seq: string;
  readonly text: string;

  constructor(props: CommandProps<WakeOnWhatsappContactCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.botId = props.botId;
    this.whatsappAccountId = props.whatsappAccountId;
    this.chatId = props.chatId;
    this.chatKind = props.chatKind;
    this.chatName = props.chatName;
    this.senderId = props.senderId;
    this.senderName = props.senderName;
    this.messageRowId = props.messageRowId;
    this.seq = props.seq;
    this.text = props.text;
  }
}
