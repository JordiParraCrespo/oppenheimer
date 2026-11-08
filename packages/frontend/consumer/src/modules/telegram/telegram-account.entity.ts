/** How a connected Telegram bot stands, as its host last reported it. */
export type TelegramAccountStatus = 'connecting' | 'connected' | 'revoked' | 'unlinked';

/**
 * One of the reader's own Telegram bots, made with @BotFather and polled by a
 * runner on one of their hosts for their Oppenheimer bots
 * (`product/next-steps/telegram.md` §2). Its token stays on the host; this is
 * how the bot stands and who it is on Telegram.
 */
export class TelegramAccountEntity {
  constructor(
    public readonly id: string,
    public readonly hostId: string,
    /** What the reader and their bots call it: "Shop", "Family". */
    public readonly label: string,
    public readonly status: TelegramAccountStatus,
    /** Whether the host's runner is connected now; nothing moves while it is not. */
    public readonly hostOnline: boolean,
    public readonly botId: string | null,
    /** The bot's `@username`, without the `@`, once its token was checked. */
    public readonly username: string | null,
    public readonly displayName: string | null,
    public readonly statusReason: string | null,
    public readonly linkedAt: string,
  ) {}

  /** The bot's address on Telegram (`https://t.me/shop_helper_bot`), or null before it is known. */
  get link(): string | null {
    return this.username ? `https://t.me/${encodeURIComponent(this.username)}` : null;
  }

  /** The host is checking the token or reconnecting: the page keeps asking how it stands. */
  get isConnecting(): boolean {
    return this.status === 'connecting' && this.hostOnline;
  }

  /** The token is gone (revoked in @BotFather, or disconnected) and the reader pastes a new one. */
  get needsToken(): boolean {
    return this.status === 'revoked' || this.status === 'unlinked';
  }
}
