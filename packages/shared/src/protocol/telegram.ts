import { z } from 'zod/v4';
import { commandIdSchema } from './primitives.js';

/**
 * Telegram on the link (`product/next-steps/telegram.md`): the messages behind
 * the `telegram` capability. A runner that names it holds one Telegram bot —
 * OpenClaw's route, the official Bot API on a token from @BotFather, long
 * polled — and the token never leaves the host after `telegram.link` hands it
 * over. The control plane asks it to connect, disconnect and send; the runner
 * tells it how the bot stands and hands it each message the bot receives,
 * which the control plane keeps so the owner's bots can read the chats. Part
 * of `protocolMessageSchema`, which is where every kind is listed.
 */

/** How many messages one `telegram.messages` carries at most. */
export const TELEGRAM_BATCH_MAX_MESSAGES = 50;

/** The longest text one Telegram message carries, in characters: the Bot API's own limit. */
export const TELEGRAM_TEXT_MAX_CHARS = 4_096;

/** A Telegram chat or user id: a signed 64-bit integer, as decimal text so no side loses precision. */
const telegramId = () =>
  z
    .string()
    .regex(/^-?\d{1,20}$/)
    .max(21);

/** A name Telegram gives a chat or a person: a group's title, a first and last name. */
const displayName = () => z.string().min(1).max(200);

/** A bot or user's `@username`, without the `@`. */
const username = () => z.string().min(1).max(64);

/** How the bot stands, as the runner sees it. */
export const TELEGRAM_BOT_STATES = [
  /** No bot: never connected, or disconnected from the console. */
  'unlinked',
  /** A token is held and the poller is not answering yet (or is backing off). */
  'connecting',
  /** Polling: messages flow both ways. */
  'connected',
  /** Telegram refused the token (`401`): it was revoked in @BotFather. Connect again with a new one. */
  'revoked',
] as const;
export type TelegramBotState = (typeof TELEGRAM_BOT_STATES)[number];

/**
 * Connect a bot by its token. The runner checks it with `getMe`, keeps it in
 * its state directory, deletes the bot's webhook and starts polling, then
 * answers with `telegram.state` `connected`. Refused with `command.failed`:
 * `TG_001` Telegram refused the token, `TG_002` the host already holds
 * another bot. The same token again resumes the bot already held.
 */
export const telegramLinkSchema = z.object({
  type: z.literal('telegram.link'),
  commandId: commandIdSchema,
  /** The bot's token, `123456789:AA…`. Never stored or logged by the control plane. */
  token: z
    .string()
    .regex(/^\d{1,20}:[A-Za-z0-9_-]{20,128}$/)
    .max(160),
});

export type TelegramLinkMessage = z.infer<typeof telegramLinkSchema>;

/**
 * Stop polling, forget the token and empty the outbox. Answered with
 * `telegram.state` `unlinked`; a host with no bot answers the same.
 */
export const telegramUnlinkSchema = z.object({
  type: z.literal('telegram.unlink'),
  commandId: commandIdSchema,
});

export type TelegramUnlinkMessage = z.infer<typeof telegramUnlinkSchema>;

/**
 * How the bot stands. Sent after every hello, on every change, and in answer
 * to `telegram.link` and `telegram.unlink`. The control plane keeps the last
 * one on the host's account; it is a state, not an event.
 */
export const telegramStateSchema = z.object({
  type: z.literal('telegram.state'),
  state: z.enum(TELEGRAM_BOT_STATES),
  /** The bot's own user id, once its token was checked. */
  botId: telegramId().optional(),
  /** The bot's `@username`, without the `@`. */
  username: username().optional(),
  /** The bot's name, as @BotFather has it. */
  name: displayName().optional(),
  /** Why the bot is `revoked` or `unlinked`, in the runner's words. */
  reason: z.string().max(200).optional(),
});

export type TelegramStateMessage = z.infer<typeof telegramStateSchema>;

/** What a message carries besides its text. Only the kind is sent: media stays on Telegram. */
export const TELEGRAM_MEDIA_KINDS = [
  'photo',
  'video',
  'audio',
  'voice',
  'document',
  'sticker',
  'animation',
  'contact',
  'location',
  'poll',
] as const;
export type TelegramMediaKind = (typeof TELEGRAM_MEDIA_KINDS)[number];

/** One message the bot received, as the runner turns a Bot API update into the shape the control plane keeps. */
export const telegramInboundSchema = z.object({
  /** The runner's outbox key for it, which `telegram.ack` names. */
  key: z.string().min(1).max(256),
  /** Telegram's message id, unique within its chat. */
  id: z.string().regex(/^\d{1,20}$/),
  chatId: telegramId(),
  /** `private` is `direct`; `group` and `supergroup` are `group`. Channel posts are dropped. */
  chatKind: z.enum(['direct', 'group']),
  /** The group's title, or the other person's name in a direct chat. */
  chatName: displayName().optional(),
  senderId: telegramId(),
  senderName: displayName().optional(),
  senderUsername: username().optional(),
  /** The text, or a media message's caption; empty for media with none. */
  text: z.string().max(TELEGRAM_TEXT_MAX_CHARS),
  media: z.enum(TELEGRAM_MEDIA_KINDS).optional(),
  /** The message it replies to, in the same chat. */
  replyToId: z
    .string()
    .regex(/^\d{1,20}$/)
    .optional(),
  sentAt: z.iso.datetime(),
});

export type TelegramInbound = z.infer<typeof telegramInboundSchema>;

/**
 * Messages that arrived, oldest first. The runner keeps each on disk until the
 * control plane acknowledges it, and resends what is unacknowledged on the
 * next link.
 */
export const telegramMessagesSchema = z.object({
  type: z.literal('telegram.messages'),
  messages: z.array(telegramInboundSchema).min(1).max(TELEGRAM_BATCH_MAX_MESSAGES),
});

export type TelegramMessagesMessage = z.infer<typeof telegramMessagesSchema>;

/** The control plane stored these messages; the runner forgets them. */
export const telegramAckSchema = z.object({
  type: z.literal('telegram.ack'),
  keys: z.array(z.string().min(1).max(256)).min(1).max(TELEGRAM_BATCH_MAX_MESSAGES),
});

export type TelegramAckMessage = z.infer<typeof telegramAckSchema>;

/**
 * Send a plain-text message to one chat, as the bot. Answered by
 * `telegram.sent` with the same `commandId`, or `command.failed`: `TG_003`
 * no bot is connected, `TG_004` Telegram refused it (the person blocked the
 * bot, the bot left the group, the chat never wrote to it).
 */
export const telegramSendSchema = z.object({
  type: z.literal('telegram.send'),
  commandId: commandIdSchema,
  chatId: telegramId(),
  text: z.string().min(1).max(TELEGRAM_TEXT_MAX_CHARS),
  /** A message of that chat to reply to. */
  replyToId: z
    .string()
    .regex(/^\d{1,20}$/)
    .optional(),
});

export type TelegramSendMessage = z.infer<typeof telegramSendSchema>;

/** Telegram took the message: its id and when it was sent. */
export const telegramSentSchema = z.object({
  type: z.literal('telegram.sent'),
  commandId: commandIdSchema,
  id: z.string().regex(/^\d{1,20}$/),
  sentAt: z.iso.datetime(),
});

export type TelegramSentMessage = z.infer<typeof telegramSentSchema>;
