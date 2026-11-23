import type { WhatsappChatGrantEntity } from './whatsapp-chat-grant.entity';

/** Who answers a chat: no one, the number's default bot, or one bot. */
export type WhatsappChatAnswer =
  | { kind: 'none' }
  | { kind: 'default' }
  | { kind: 'bot'; botId: string };

/**
 * One chat one of the reader's numbers has seen (or allows with no message
 * kept): a group or a person, how much of it the number keeps, when it last
 * wrote, and who answers it there (`answer`), read off its grant.
 */
export class WhatsappChatRouteEntity {
  constructor(
    public readonly accountId: string,
    /** The chat's WhatsApp id: a group's `…@g.us`, or a person's `<digits>@s.whatsapp.net`. */
    public readonly chatId: string,
    public readonly chatKind: 'direct' | 'group',
    public readonly chatName: string | null,
    public readonly messageCount: number,
    /** When the number last saw a message in it; null for a chat allowed before any. */
    public readonly lastAt: Date | null,
    /** Its grant while it is answered; null when no one answers it. */
    public readonly grant: WhatsappChatGrantEntity | null,
  ) {}

  get isGroup(): boolean {
    return this.chatKind === 'group';
  }

  /** A person's number as they write it (`+34600111222`); null for a group. */
  get phone(): string | null {
    const [user, server] = this.chatId.split('@');
    return server === 's.whatsapp.net' && user ? `+${user.split(':')[0]}` : null;
  }

  /** What to call the chat: its name, else a person's number, else its id. */
  get title(): string {
    return this.chatName ?? this.phone ?? this.chatId;
  }

  get answer(): WhatsappChatAnswer {
    if (!this.grant) return { kind: 'none' };
    return this.grant.botId ? { kind: 'bot', botId: this.grant.botId } : { kind: 'default' };
  }

  /** Whether `botId` answers it, by name or as the number's default (`defaultBotId`). */
  answeredBy(botId: string, defaultBotId: string | null): boolean {
    const answer = this.answer;
    if (answer.kind === 'bot') return answer.botId === botId;
    return answer.kind === 'default' && defaultBotId === botId;
  }
}
