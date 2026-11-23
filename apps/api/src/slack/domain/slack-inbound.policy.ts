/**
 * The part of a Slack event callback (`type: 'event_callback'`) the app acts
 * on: a mention in a channel (`app_mention`) or a message in its DM
 * (`message`, `channel_type: 'im'`). Slack's other fields are not read.
 */
export interface SlackEvent {
  type: string;
  user?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  channel?: string;
  channel_type?: string;
  bot_id?: string;
  subtype?: string;
}

/**
 * What one event comes to:
 *
 * - `link`: `link <code>` in the app's DM from someone who is not its owner;
 *   the account decides whether the code records them (`claimOwner`).
 * - `owner`: the recorded owner asked, in a DM or by a mention: a turn in the
 *   thread it was asked in (`message`), or that thread's running turn stopped
 *   (`stop`).
 * - `ignore`: anyone else (Slack is the owner's only), the app's own and other
 *   bots' messages, edits and deletions, and anything without words.
 */
export type SlackInboundAction =
  | { kind: 'link'; code: string; user: string; channel: string; ts: string }
  | {
      kind: 'owner';
      command: 'message' | 'stop';
      text: string;
      channel: string;
      /** The thread the answer goes in: the one asked in, or the message itself when it is top-level. */
      threadTs: string;
      ts: string;
    }
  | { kind: 'ignore' };

/** What the app knows of who may ask: its own bot user and its owner. */
export interface SlackInboundAccount {
  botUserId: string;
  ownerSlackUserId: string | null;
}

/** Sent in the DM when a `link` code recorded the owner; never anything a model wrote. */
export const SLACK_LINKED_LINE =
  'Linked: you are my owner now. Mention me in a channel, or write to me here, and I answer in the thread.';

/** Sent when the owner's `stop` asked the thread's running turn to stop. */
export const SLACK_STOP_LINE = 'Stopping.';

const LINK = /^link\s+([A-Za-z0-9_-]{8,64})$/i;
const STOP = /^stop[.!]?$/i;
/** Message subtypes that are still someone writing; any other (an edit, a join) is not. */
const WRITTEN_SUBTYPES = new Set(['file_share', 'thread_broadcast']);

/** What one event comes to, for an app that knows `account`. */
export function slackInboundAction(
  account: SlackInboundAccount,
  event: SlackEvent,
): SlackInboundAction {
  const direct = event.type === 'message' && event.channel_type === 'im';
  if (!direct && event.type !== 'app_mention') return { kind: 'ignore' };
  if (event.bot_id || (event.subtype && !WRITTEN_SUBTYPES.has(event.subtype))) {
    return { kind: 'ignore' };
  }
  const { user, channel, ts } = event;
  if (!user || !channel || !ts || user === account.botUserId) return { kind: 'ignore' };
  const text = slackPlainText(event.text ?? '', account.botUserId);
  const isOwner = account.ownerSlackUserId !== null && user === account.ownerSlackUserId;
  if (!isOwner) {
    const link = direct ? LINK.exec(text) : null;
    return link ? { kind: 'link', code: link[1], user, channel, ts } : { kind: 'ignore' };
  }
  if (!text) return { kind: 'ignore' };
  return {
    kind: 'owner',
    command: STOP.test(text) ? 'stop' : 'message',
    text,
    channel,
    threadTs: event.thread_ts ?? ts,
    ts,
  };
}

/**
 * A message's text as plain words: the app's own mention dropped, other
 * mentions and links in their readable form, and Slack's three escapes
 * undone (`https://api.slack.com/reference/surfaces/formatting#escaping`).
 */
export function slackPlainText(text: string, botUserId: string): string {
  return text
    .replaceAll(`<@${botUserId}>`, '')
    .replace(/<([@#!])([^>|]+)(?:\|([^>]*))?>/g, (_, sigil: string, id: string, label?: string) =>
      sigil === '!' ? `@${label || id}` : `${sigil}${label || id}`,
    )
    .replace(/<([^>|]+)\|([^>]+)>/g, '$2 ($1)')
    .replace(/<([^>]+)>/g, '$1')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .trim();
}

/**
 * A Slack timestamp as a position in its channel: `1700000000.000200` is
 * `1700000000000200`, a number that orders the channel's messages and fits a
 * bigint. Null for anything that is not one.
 */
export function slackTsPosition(ts: string): string | null {
  const match = /^(\d{1,12})\.(\d{6})$/.exec(ts);
  return match ? `${match[1]}${match[2]}`.replace(/^0+(?=\d)/, '') : null;
}
