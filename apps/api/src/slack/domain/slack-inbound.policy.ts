import {
  BOT_IMAGE_MAX_BYTES,
  BOT_IMAGE_MIME_TYPES,
  BOT_MESSAGE_IMAGES_MAX,
} from '@oppenheimer/shared';

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
  /** What the message shares (`file_share`): its files, as Slack describes them. */
  files?: SlackEventFile[];
}

/** One file a message shares, the fields the app reads. */
export interface SlackEventFile {
  id?: string;
  name?: string;
  mimetype?: string;
  size?: number;
  url_private_download?: string;
  url_private?: string;
}

/**
 * An image the owner's message carries, to be fetched with the app's token
 * when the turn is queued: only ever from Slack's own file host.
 */
export interface SlackImage {
  id: string;
  name: string;
  url: string;
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
 *   bots' messages, edits and deletions, and anything with neither words nor
 *   a file.
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
      /** The images it carries that a bot can read, at most `BOT_MESSAGE_IMAGES_MAX`. */
      images: SlackImage[];
      /** The files it carries that are left out: not an image a bot reads, too large, or past the limit. */
      skippedFiles: number;
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

/**
 * What one event comes to, for an app that knows `account`; `names` are the
 * display names of the people its words mention, as far as they are known.
 */
export function slackInboundAction(
  account: SlackInboundAccount,
  event: SlackEvent,
  names: ReadonlyMap<string, string> = new Map(),
): SlackInboundAction {
  const direct = event.type === 'message' && event.channel_type === 'im';
  if (!direct && event.type !== 'app_mention') return { kind: 'ignore' };
  if (event.bot_id || (event.subtype && !WRITTEN_SUBTYPES.has(event.subtype))) {
    return { kind: 'ignore' };
  }
  const { user, channel, ts } = event;
  if (!user || !channel || !ts || user === account.botUserId) return { kind: 'ignore' };
  const text = slackPlainText(event.text ?? '', account.botUserId, names);
  const isOwner = account.ownerSlackUserId !== null && user === account.ownerSlackUserId;
  if (!isOwner) {
    const link = direct ? LINK.exec(text) : null;
    return link ? { kind: 'link', code: link[1], user, channel, ts } : { kind: 'ignore' };
  }
  const files = event.files ?? [];
  if (!text && files.length === 0) return { kind: 'ignore' };
  const images = slackImagesOf(files);
  return {
    kind: 'owner',
    command: STOP.test(text) && files.length === 0 ? 'stop' : 'message',
    text,
    channel,
    threadTs: event.thread_ts ?? ts,
    ts,
    images,
    skippedFiles: files.length - images.length,
  };
}

/** Slack's file host: the one place the app sends its token to fetch a file. */
export const SLACK_FILE_HOST = 'files.slack.com';

/**
 * The files of a message a bot can read as images, in order: a type a bot
 * reads (`BOT_IMAGE_MIME_TYPES`, as Slack says; the bytes are judged again
 * when fetched), no larger than `BOT_IMAGE_MAX_BYTES`, on Slack's file host
 * over HTTPS, at most `BOT_MESSAGE_IMAGES_MAX`.
 */
export function slackImagesOf(files: readonly SlackEventFile[]): SlackImage[] {
  const images: SlackImage[] = [];
  for (const file of files) {
    if (images.length >= BOT_MESSAGE_IMAGES_MAX) break;
    const url = file.url_private_download ?? file.url_private;
    const type = file.mimetype ?? '';
    if (!file.id || !url || !isSlackFileUrl(url)) continue;
    if (!(BOT_IMAGE_MIME_TYPES as readonly string[]).includes(type)) continue;
    if (typeof file.size === 'number' && file.size > BOT_IMAGE_MAX_BYTES) continue;
    images.push({ id: file.id, name: slackFileName(file.name), url });
  }
  return images;
}

/**
 * A shared file's name as the event carries it: no control characters (a NUL
 * cannot be stored), cut between characters at `SLACK_FILE_NAME_MAX`, never
 * inside one, so the event's JSON stays storable.
 */
export function slackFileName(name: string | undefined): string {
  const printable = Array.from(name ?? '').filter(isPrintable);
  return printable.slice(0, SLACK_FILE_NAME_MAX).join('') || 'image';
}

/** Whether `url` is a file on Slack's file host, over HTTPS, with no port or credentials of its own. */
export function isSlackFileUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === SLACK_FILE_HOST &&
      parsed.port === '' &&
      parsed.username === '' &&
      parsed.password === ''
    );
  } catch {
    return false;
  }
}

/** At most this many people a message mentions are looked up by name; past it the rest stay ids. */
export const SLACK_MENTIONS_NAMED_MAX = 10;

/**
 * The Slack users a message mentions by id alone (`<@U0123>`, which Slack sends
 * with no name), the app's own left out, in order and once each, at most
 * `SLACK_MENTIONS_NAMED_MAX`: the ones to look up so the bot reads names.
 */
export function slackMentionedUsers(text: string, botUserId: string): string[] {
  const ids = new Set<string>();
  for (const match of text.matchAll(/<@([UW][A-Z0-9]{1,32})>/g)) {
    if (match[1] !== botUserId) ids.add(match[1]);
  }
  return [...ids].slice(0, SLACK_MENTIONS_NAMED_MAX);
}

/** The people to look up by name for an event: those the owner's message mentions, and none for any other. */
export function slackMentionsToName(account: SlackInboundAccount, event: SlackEvent): string[] {
  if (slackInboundAction(account, event).kind !== 'owner') return [];
  return slackMentionedUsers(event.text ?? '', account.botUserId);
}

/**
 * A message's text as plain words: the app's own mention dropped, other
 * mentions and links in their readable form (a person by the name in
 * `names`, else by the label Slack sent, else by id), and Slack's three
 * escapes undone (`https://api.slack.com/reference/surfaces/formatting#escaping`).
 */
export function slackPlainText(
  text: string,
  botUserId: string,
  names: ReadonlyMap<string, string> = new Map(),
): string {
  return text
    .replaceAll(`<@${botUserId}>`, '')
    .replace(/<([@#!])([^>|]+)(?:\|([^>]*))?>/g, (_, sigil: string, id: string, label?: string) =>
      sigil === '!'
        ? `@${label || id}`
        : `${sigil}${label || (sigil === '@' ? names.get(id) : undefined) || id}`,
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

/** The longest name a mention is read by, in characters. */
export const SLACK_USER_NAME_MAX = 80;

/** The longest file name an event carries, in characters. */
export const SLACK_FILE_NAME_MAX = 200;

/**
 * A person's name from Slack's `users.info` user: their display name, else
 * their full name, else their handle, cut to `SLACK_USER_NAME_MAX` by
 * characters, never inside one (half an emoji is a lone surrogate, which
 * Postgres's JSON refuses), without control characters; null when Slack gives none.
 */
export function slackUserName(user: unknown): string | null {
  const record = recordOf(user);
  const profile = recordOf(record.profile);
  const name = [profile.display_name, profile.real_name, record.real_name, record.name]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean);
  if (!name) return null;
  const printable = Array.from(name).filter(isPrintable);
  return printable.length > 0 ? printable.slice(0, SLACK_USER_NAME_MAX).join('') : null;
}

/** A character Postgres stores and a reader sees: no NUL or other control character. */
function isPrintable(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return code >= 0x20 && code !== 0x7f;
}

function recordOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
