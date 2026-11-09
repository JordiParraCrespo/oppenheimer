import { z } from 'zod';

/**
 * Telegram (`product/next-steps/telegram.md`): a bot the person made with
 * @BotFather, polled by a runner on one of their hosts, the way OpenClaw does
 * it. Their Oppenheimer bots read its chats and write in them.
 */

/** What a person calls a connected bot: "Shop", "Family". */
export const TELEGRAM_LABEL_MAX = 64;

/** Telegram bots one person connects, one per host. */
export const TELEGRAM_ACCOUNTS_MAX = 3;

/** Messages one Oppenheimer bot sends through one Telegram bot in a day, on top of the host's pacing. */
export const TELEGRAM_SENDS_PER_DAY = 200;

/** How long the messages a Telegram bot receives are kept for the owner's bots to read. */
export const TELEGRAM_RETENTION_DAYS = 90;

/** The most messages kept for one Telegram bot, whatever their age: the oldest go first. */
export const TELEGRAM_MESSAGES_KEPT_MAX = 50_000;

/** How an account stands: the runner's bot state, kept as the host last reported it. */
export const TELEGRAM_ACCOUNT_STATUSES = [
  'connecting',
  'connected',
  'revoked',
  'unlinked',
] as const;
export type TelegramAccountStatus = (typeof TELEGRAM_ACCOUNT_STATUSES)[number];

/** A BotFather token: the bot's id, a colon, and its secret. */
export const TELEGRAM_TOKEN_PATTERN = /^\d{1,20}:[A-Za-z0-9_-]{20,128}$/;

/**
 * `POST /telegram/accounts`: connect a bot on one of the caller's hosts by its
 * token, or hand the bot already there a new one (after a revoke).
 */
export const linkTelegramSchema = z.object({
  hostId: z.string().uuid(),
  token: z.string().trim().max(160).regex(TELEGRAM_TOKEN_PATTERN),
  label: z.string().trim().max(TELEGRAM_LABEL_MAX).optional(),
});

export type LinkTelegramDto = z.infer<typeof linkTelegramSchema>;

/** One of the caller's connected Telegram bots, as Settings lists it. The token is never part of it. */
export const telegramAccountSchema = z.object({
  id: z.string().uuid(),
  hostId: z.string().uuid(),
  label: z.string(),
  status: z.enum(TELEGRAM_ACCOUNT_STATUSES),
  hostOnline: z.boolean(),
  botId: z.string().nullable(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  statusReason: z.string().nullable(),
  /** The Oppenheimer bot that answers the owner here; null while none does. */
  answeringBotId: z.string().uuid().nullable(),
  /** Whether the owner's Telegram account is recorded, by the one-time `start` link. */
  ownerLinked: z.boolean(),
  linkedAt: z.string(),
});

export type TelegramAccount = z.infer<typeof telegramAccountSchema>;

/**
 * `PATCH /telegram/accounts/:id`: which of the caller's Oppenheimer bots
 * answers them on this Telegram bot; null for none
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md` §1).
 */
export const updateTelegramAccountSchema = z.object({
  answeringBotId: z.string().uuid().nullable(),
});

export type UpdateTelegramAccountDto = z.infer<typeof updateTelegramAccountSchema>;

/**
 * `POST /telegram/accounts/:id/owner-link`: a one-time link that records
 * whoever opens it in Telegram as the bot's owner, for ten minutes.
 */
export const telegramOwnerLinkSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string(),
});

export type TelegramOwnerLink = z.infer<typeof telegramOwnerLinkSchema>;
