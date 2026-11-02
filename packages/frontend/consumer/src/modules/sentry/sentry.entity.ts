/** The workspace's connected Sentry organization (`product/next-steps/sentry.md`). */
export interface SentryConnection {
  id: string;
  organizationSlug: string;
  /** The client secret's last four characters; the secret itself never comes back. */
  secretHint: string;
  /** Where the integration posts its webhooks: pasted into Sentry. */
  webhookUrl: string;
  connectedAt: Date;
}

/** Whether this server can connect Sentry, and the workspace's connection if any. */
export interface SentryStatus {
  configured: boolean;
  connection: SentryConnection | null;
}
