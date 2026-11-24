/** How a bot's Slack app stands: answering, or its token refused by Slack. */
export type SlackAccountStatus = 'connected' | 'revoked';

/**
 * One of the reader's bots' own Slack app, installed in one Slack workspace.
 * Its token and signing secret stay sealed on the server; this is who the app
 * is in Slack and whether it answers.
 */
export class SlackAccountEntity {
  constructor(
    public readonly id: string,
    /** The reader's bot the app is. */
    public readonly botId: string,
    public readonly status: SlackAccountStatus,
    public readonly statusReason: string | null,
    public readonly teamId: string,
    /** The Slack workspace it is installed in: "Acme". */
    public readonly teamName: string,
    public readonly botUserId: string,
    /** The app's bot user as Slack names it: `juno`. */
    public readonly botName: string,
    /** The bot token's last characters, to tell two apart. */
    public readonly tokenHint: string,
    /** Whether the reader's Slack user is recorded, by the one-time `link` code. */
    public readonly ownerLinked: boolean,
    public readonly linkedAt: string,
  ) {}

  /** Slack refused the token (the app uninstalled, the token revoked): the reader pastes new ones. */
  get needsToken(): boolean {
    return this.status === 'revoked';
  }

  /** Asking the bot in Slack reaches it: the app answers and the reader is its owner. */
  get answers(): boolean {
    return this.status === 'connected' && this.ownerLinked;
  }
}
