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
  /**
   * A person's name as their workspace shows it (`users.info`): their display
   * name, else their full name, else their handle; null when Slack has none.
   * Needs `users:read`; throws as `post` does.
   */
  userName(access: SlackAppAccess, userId: string): Promise<string | null>;
  /**
   * Puts the app's reaction `name` on a message (`reactions.add`), or takes it
   * off (`reactions.remove`). One already there, or already gone, is no
   * error. Needs `reactions:write`; throws as `post` does.
   */
  react(
    access: SlackAppAccess,
    message: { channel: string; ts: string; name: string },
    on: boolean,
  ): Promise<void>;
}
