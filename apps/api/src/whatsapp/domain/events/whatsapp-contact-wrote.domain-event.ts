import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Someone who is not the number's owner wrote in a chat the number allows,
 * so that it speaks to the number (any message in a person's chat; a mention
 * of the number or a reply to it in a group), and an Oppenheimer bot answers
 * that chat: raised once per stored message, in the transaction that stored
 * it. The bot answers with a contact's turn. The aggregate is the WhatsApp
 * account.
 */
export class WhatsappContactWroteDomainEvent extends DomainEvent {
  readonly organizationId: string;
  /** The person who linked the number: the turn runs on their account, as theirs never is. */
  readonly userId: string;
  readonly accountId: string;
  /** The allowed chat, as its JID: a person's or a group's. */
  readonly chatId: string;
  readonly chatKind: 'direct' | 'group';
  readonly chatName: string | null;
  /** Who wrote it, as their JID, and the name WhatsApp shows for them. */
  readonly senderId: string;
  readonly senderName: string | null;
  /** The stored `whatsapp_message` row: the turn's key, and what the reply quotes. */
  readonly messageRowId: string;
  /** Its `whatsapp_message.seq`: where it falls in the chat. */
  readonly seq: string;
  /** The chat's bot: the one chosen for it, or the number's default. */
  readonly botId: string;
  readonly text: string;

  constructor(props: DomainEventProps<WhatsappContactWroteDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.accountId = props.accountId;
    this.chatId = props.chatId;
    this.chatKind = props.chatKind;
    this.chatName = props.chatName;
    this.senderId = props.senderId;
    this.senderName = props.senderName;
    this.messageRowId = props.messageRowId;
    this.seq = props.seq;
    this.botId = props.botId;
    this.text = props.text;
  }
}
