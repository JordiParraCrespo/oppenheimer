/**
 * One of the reader's own Gmail accounts, connected for their bots
 * (`product/next-steps/mail.md` §1). Never its token.
 */
export class GmailConnectionEntity {
  constructor(
    public readonly id: string,
    public readonly accountEmail: string,
    /** What the reader and their bots call it: "Personal", "Work". */
    public readonly label: string,
    public readonly status: 'active' | 'revoked',
    public readonly connectedAt: string,
  ) {}

  /** Google dropped the grant: bots cannot reach it until it is reconnected. */
  get needsReconnect(): boolean {
    return this.status === 'revoked';
  }
}
