import type { SlackIdentity } from '../domain/slack-account.entity';

/** Which app a call is made as: its token, and the bucket Slack counts it against. */
export interface SlackAppAccess {
  botToken: string;
  /** `app:<team id>:<bot user id>`: Slack counts calls per app and workspace. */
  bucket: string;
}

/** A Slack message sent: the channel and its timestamp there. */
export interface SlackPosted {
  channel: string;
  ts: string;
}

/** Slack's Web API, the calls the app makes. */
export interface SlackWebApiPort {
  /** Who a bot token is (`auth.test`); `SLACK_004` for a token Slack refuses. */
  identify(botToken: string): Promise<SlackIdentity>;
  /**
   * Posts plain text in a channel, in a thread when `threadTs` is given
   * (`chat.postMessage`). `SLACK_004` when Slack refuses the token.
   */
  post(
    access: SlackAppAccess,
    message: { channel: string; text: string; threadTs: string | null },
  ): Promise<SlackPosted>;
}
