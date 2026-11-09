import type { TelegramMessageDraft } from './telegram-message.types';

/**
 * What a message to a Telegram bot comes to
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md` §2):
 *
 * - `link`: `/start <code>` in a direct chat; the account decides whether the
 *   code records its sender as the owner (`TelegramAccountEntity.claimOwner`).
 * - `owner`: the recorded owner wrote in their direct chat, to the bot that
 *   answers here (`new` and `stop` are the commands that act on it).
 * - `reply`: a fixed line and nothing else: the owner's `/help`, or the owner
 *   writing while no bot answers here.
 * - `stranger`: anyone else in a direct chat; held, with at most one fixed
 *   line a day (`TELEGRAM_STRANGER_LINE`).
 * - `ignore`: the bot's own messages, and every group message: groups are off
 *   until slice 2 lets the owner allow one.
 */
export type TelegramInboundAction =
  | { kind: 'link'; code: string }
  | { kind: 'owner'; command: 'message' | 'new' | 'stop'; text: string }
  | { kind: 'reply'; text: string }
  | { kind: 'stranger' }
  | { kind: 'ignore' };

/** What the account knows of who may talk: its owner and the bot that answers them. */
export interface TelegramInboundAccount {
  ownerTelegramId: string | null;
  answeringBotId: string | null;
}

/** Sent to a stranger, at most once a day; never anything a model wrote. */
export const TELEGRAM_STRANGER_LINE = 'This bot only talks to its owner.';

/** Sent when the `start` link recorded the owner. */
export const TELEGRAM_LINKED_LINE =
  'Linked: you are this bot’s owner now. Write to me here and I will answer.';

/** Sent when the owner writes and no Oppenheimer bot answers here. */
export const TELEGRAM_NO_BOT_LINE =
  'No bot answers here yet. Choose one in Oppenheimer, under Settings → Telegram.';

/** The owner's `/help`. */
export const TELEGRAM_HELP_LINE =
  'Write to me and I answer here. /new starts a fresh conversation; /stop stops what I am doing.';

/** Sent when `/new` closed the conversation. */
export const TELEGRAM_NEW_LINE = 'Started a new conversation.';

/** Sent when `/stop` asked the running turn to stop. */
export const TELEGRAM_STOP_LINE = 'Stopping.';

/**
 * The commands the owner sends, by name: a fixed line, or what the bot that
 * answers here does. A new command is a row; anything else is a message.
 */
const OWNER_COMMANDS: Readonly<Record<string, TelegramInboundAction>> = {
  start: { kind: 'reply', text: TELEGRAM_HELP_LINE },
  help: { kind: 'reply', text: TELEGRAM_HELP_LINE },
  new: { kind: 'owner', command: 'new', text: '' },
  stop: { kind: 'owner', command: 'stop', text: '' },
};

/** A bot command at the start of a message, optionally addressed (`/new@shop_helper_bot`). */
const COMMAND = /^\/([a-z]+)(?:@\w+)?(?:\s+(\S+))?\s*$/i;

/** What one received message comes to, for an account that knows `account`. */
export function telegramInboundAction(
  account: TelegramInboundAccount,
  message: Pick<TelegramMessageDraft, 'chatKind' | 'fromBot' | 'senderId' | 'text' | 'media'>,
): TelegramInboundAction {
  if (message.fromBot || message.chatKind !== 'direct') return { kind: 'ignore' };
  const command = COMMAND.exec(message.text.trim());
  const name = command?.[1]?.toLowerCase();
  const isOwner = account.ownerTelegramId !== null && message.senderId === account.ownerTelegramId;
  // The owner opening a link again (a second tap) is not a stranger.
  if (name === 'start' && command?.[2] && !isOwner) return { kind: 'link', code: command[2] };
  if (!isOwner) return { kind: 'stranger' };
  const owned = name && Object.hasOwn(OWNER_COMMANDS, name) ? OWNER_COMMANDS[name] : undefined;
  if (owned?.kind === 'reply') return owned;
  if (!account.answeringBotId) return { kind: 'reply', text: TELEGRAM_NO_BOT_LINE };
  if (owned) return owned;
  const text = message.text.trim() || (message.media ? `[${message.media}]` : '');
  if (!text) return { kind: 'ignore' };
  return { kind: 'owner', command: 'message', text };
}
