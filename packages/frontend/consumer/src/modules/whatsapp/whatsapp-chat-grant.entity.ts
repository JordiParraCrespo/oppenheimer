/**
 * A chat one of the reader's numbers allows besides their own: a group or
 * another person, the bot that answers there (the number's default while
 * `botId` is null), and the bot that allowed it, when one did in the reader's
 * own chat with it.
 */
export class WhatsappChatGrantEntity {
  constructor(
    public readonly id: string,
    public readonly accountId: string,
    /** The chat's WhatsApp id: a group's `…@g.us`, or a person's `<digits>@s.whatsapp.net`. */
    public readonly chatId: string,
    public readonly chatKind: 'direct' | 'group',
    /** The name the number last saw for the group or person; null when it has none yet. */
    public readonly chatName: string | null,
    public readonly botId: string | null,
    public readonly grantedByBotId: string | null,
    public readonly grantedAt: Date,
  ) {}

  get isGroup(): boolean {
    return this.chatKind === 'group';
  }

  /** What to call the chat: its name, else a person's number as they write it, else its id. */
  get title(): string {
    if (this.chatName) return this.chatName;
    const [user, server] = this.chatId.split('@');
    return server === 's.whatsapp.net' && user ? `+${user.split(':')[0]}` : this.chatId;
  }
}
