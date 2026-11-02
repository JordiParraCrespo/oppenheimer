/**
 * A message one of the reader's bots will send from their Gmail at a time,
 * still waiting (`product/next-steps/mail.md` §3.4). Cancelled, it never goes.
 */
export class ScheduledMailEntity {
  constructor(
    public readonly id: string,
    public readonly accountEmail: string,
    public readonly recipients: readonly string[],
    public readonly subject: string,
    public readonly scheduledFor: Date,
    /** The bot that scheduled it; `null` once that bot is deleted. */
    public readonly botId: string | null,
  ) {}
}
