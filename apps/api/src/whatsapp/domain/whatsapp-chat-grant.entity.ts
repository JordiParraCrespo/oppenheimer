import { randomUUID } from 'node:crypto';
import { AggregateRoot, type CreateEntityProps } from '@oppenheimer/backend-ddd';
import type { WhatsappChatKind } from '@oppenheimer/shared';

export interface WhatsappChatGrantProps {
  organizationId: string;
  /** The linked number the chat is on. */
  accountId: string;
  chatId: string;
  chatKind: WhatsappChatKind;
  chatName: string | null;
  /** The bot that answers in this chat; null for the number's default. */
  botId: string | null;
  /** The bot whose tool allowed it, in the owner's own chat with it; null when allowed in Settings. */
  grantedByBotId: string | null;
}

/**
 * A chat the confirmed owner of a number allowed on it besides their own: a
 * group, or another person. Allowing is who may talk; which bot answers is
 * `botId`, the number's default while it is null.
 */
export class WhatsappChatGrantEntity extends AggregateRoot<WhatsappChatGrantProps> {
  static create(create: CreateEntityProps<WhatsappChatGrantProps>): WhatsappChatGrantEntity {
    return new WhatsappChatGrantEntity(create);
  }

  static allow(props: WhatsappChatGrantProps): WhatsappChatGrantEntity {
    return new WhatsappChatGrantEntity({ id: randomUUID(), props: { ...props } });
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get accountId(): string {
    return this.props.accountId;
  }
  get chatId(): string {
    return this.props.chatId;
  }
  get chatKind(): WhatsappChatKind {
    return this.props.chatKind;
  }
  get chatName(): string | null {
    return this.props.chatName;
  }
  get botId(): string | null {
    return this.props.botId;
  }
  get grantedByBotId(): string | null {
    return this.props.grantedByBotId;
  }

  /** The bot that answers in this chat from now on; null for the number's default. */
  answerAs(botId: string | null): void {
    this.props.botId = botId;
    this.setUpdatedAt(new Date());
  }

  /** The chat's name as the number last saw it; a chat with none keeps the one it had. */
  seenAs(chatName: string | null): void {
    if (chatName) this.props.chatName = chatName;
  }

  public validate(): void {}
}
