import { z } from 'zod';

/**
 * Slack: a Slack app of the bot's own, so it has its own name and face in
 * Slack. The person creates it from the manifest the console gives them,
 * installs it to their Slack workspace, and pastes its bot token and signing
 * secret; Slack then sends the app's events to the API, and the bot answers in
 * the thread it was asked in.
 */

/** A bot token, as Slack's install page shows it. */
export const SLACK_BOT_TOKEN_PATTERN = /^xoxb-[A-Za-z0-9-]{20,250}$/;

/** A signing secret, as the app's Basic Information page shows it. */
export const SLACK_SIGNING_SECRET_PATTERN = /^[a-f0-9]{32}$/;

/** How a connected app stands: answering, or its token refused by Slack (revoked, uninstalled). */
export const SLACK_ACCOUNT_STATUSES = ['connected', 'revoked'] as const;
export type SlackAccountStatus = (typeof SLACK_ACCOUNT_STATUSES)[number];

/**
 * The bot scopes the manifest asks for: read a mention or a DM, answer in its
 * thread, mark the message it is working on (`reactions:write`) and read the
 * people a message mentions by name (`users:read`). An app made before the
 * last two works without them: no reaction, mentions read as ids.
 */
export const SLACK_BOT_SCOPES = [
  'app_mentions:read',
  'chat:write',
  'im:history',
  'im:read',
  'im:write',
  'reactions:write',
  'users:read',
] as const;

/** The events the app subscribes to: a mention in a channel, and a message in its DM. */
export const SLACK_BOT_EVENTS = ['app_mention', 'message.im'] as const;

/** Slack's longest app name; the manifest cuts the bot's name to it. */
export const SLACK_APP_NAME_MAX = 35;

/**
 * `POST /slack/accounts`: connect the bot's Slack app with its bot token and
 * signing secret, or hand the app already connected new ones.
 */
export const connectSlackSchema = z.object({
  botId: z.string().uuid(),
  botToken: z.string().trim().max(260).regex(SLACK_BOT_TOKEN_PATTERN),
  signingSecret: z.string().trim().toLowerCase().regex(SLACK_SIGNING_SECRET_PATTERN),
});

export type ConnectSlackDto = z.infer<typeof connectSlackSchema>;

/** A bot's connected Slack app, as its settings show it. Never its token or secret. */
export const slackAccountSchema = z.object({
  id: z.string().uuid(),
  /** The Oppenheimer bot the app is. */
  botId: z.string().uuid(),
  status: z.enum(SLACK_ACCOUNT_STATUSES),
  statusReason: z.string().nullable(),
  /** The Slack workspace it is installed in. */
  teamId: z.string(),
  teamName: z.string(),
  /** The app's bot user, as Slack names it (`@juno`). */
  botUserId: z.string(),
  botName: z.string(),
  /** The last characters of the bot token, to tell two apart. */
  tokenHint: z.string(),
  /** Whether the owner's Slack user is recorded, by the one-time `link` code. */
  ownerLinked: z.boolean(),
  linkedAt: z.string(),
});

export type SlackAccount = z.infer<typeof slackAccountSchema>;

/**
 * `POST /slack/accounts/:id/owner-link`: a one-time code; whoever sends
 * `link <code>` to the app in a direct message within ten minutes is recorded
 * as its owner, the only person the bot answers in Slack.
 */
export const slackOwnerLinkSchema = z.object({
  /** What to send the app, the code included. */
  message: z.string(),
  /** Opens the app's direct messages in Slack. */
  url: z.string().url(),
  expiresAt: z.string(),
});

export type SlackOwnerLink = z.infer<typeof slackOwnerLinkSchema>;

/**
 * `GET /slack/bots/:botId/app`: what creating the bot's Slack app takes: the
 * address its events go to, and the link that opens Slack's "Create an app"
 * with the manifest filled in.
 */
export const slackAppSetupSchema = z.object({
  eventsUrl: z.string().url(),
  createUrl: z.string().url(),
  manifest: z.string(),
});

export type SlackAppSetup = z.infer<typeof slackAppSetupSchema>;

/** The manifest of a bot's Slack app: its name, the scopes and events it needs, where events go. */
export function slackAppManifest(bot: {
  name: string;
  description: string;
  eventsUrl: string;
}): Record<string, unknown> {
  const name = bot.name.trim().slice(0, SLACK_APP_NAME_MAX) || 'Bot';
  return {
    display_information: {
      name,
      description: bot.description.trim().slice(0, 140) || `${name}, from Oppenheimer`,
    },
    features: {
      app_home: { messages_tab_enabled: true, messages_tab_read_only_enabled: false },
      bot_user: { display_name: name, always_online: true },
    },
    oauth_config: { scopes: { bot: [...SLACK_BOT_SCOPES] } },
    settings: {
      event_subscriptions: { request_url: bot.eventsUrl, bot_events: [...SLACK_BOT_EVENTS] },
      org_deploy_enabled: false,
      socket_mode_enabled: false,
      token_rotation_enabled: false,
    },
  };
}
