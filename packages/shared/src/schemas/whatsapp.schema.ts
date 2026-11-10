import { z } from 'zod';

/**
 * WhatsApp (`product/next-steps/whatsapp.md`): a number the person owns,
 * joined as a linked device by a runner on one of their hosts, the way
 * OpenClaw does it. Their bots read its chats and write in them.
 */

/** What a person calls a linked number: "Spare", "Shop". */
export const WHATSAPP_LABEL_MAX = 64;

/** Numbers one person links, one per host. */
export const WHATSAPP_ACCOUNTS_MAX = 3;

/** Messages one bot sends from one number in a day, on top of the host's own budget. */
export const WHATSAPP_SENDS_PER_DAY = 100;

/** How long the messages a number receives are kept for its bots to read. */
export const WHATSAPP_RETENTION_DAYS = 90;

/**
 * The most messages kept for one number, whatever their age: the oldest go
 * first. A busy personal number sees a few hundred a day; this bounds what a
 * runner can make the control plane store for one account.
 */
export const WHATSAPP_MESSAGES_KEPT_MAX = 50_000;

/** How an account stands: the runner's device state, kept as the host last reported it. */
export const WHATSAPP_ACCOUNT_STATUSES = [
  'pairing',
  'connecting',
  'connected',
  'logged_out',
  'unlinked',
] as const;
export type WhatsappAccountStatus = (typeof WHATSAPP_ACCOUNT_STATUSES)[number];

/**
 * `POST /whatsapp/accounts`: link a number on one of the caller's hosts, or
 * pair the one already there again (after a logout, or a QR left unscanned).
 */
export const linkWhatsappSchema = z.object({
  hostId: z.string().uuid(),
  label: z.string().trim().max(WHATSAPP_LABEL_MAX).optional(),
});

export type LinkWhatsappDto = z.infer<typeof linkWhatsappSchema>;

/** One of the caller's linked numbers, as Settings lists it. */
export const whatsappAccountSchema = z.object({
  id: z.string().uuid(),
  hostId: z.string().uuid(),
  label: z.string(),
  status: z.enum(WHATSAPP_ACCOUNT_STATUSES),
  hostOnline: z.boolean(),
  phone: z.string().nullable(),
  displayName: z.string().nullable(),
  qr: z.string().nullable(),
  qrExpiresAt: z.string().nullable(),
  statusReason: z.string().nullable(),
  /** The Oppenheimer bot that answers the owner on this number; null while none does. */
  answeringBotId: z.string().uuid().nullable(),
  /** The owner's own number, confirmed by the code it received, as `+digits`; null before. */
  ownerNumber: z.string().nullable(),
  /** The number a code was sent to and is waiting to be entered, as `+digits`. */
  ownerPendingNumber: z.string().nullable(),
  /** When the code waiting to be entered stops working. */
  ownerCodeExpiresAt: z.string().nullable(),
  linkedAt: z.string(),
});

export type WhatsappAccount = z.infer<typeof whatsappAccountSchema>;

/**
 * `PATCH /whatsapp/accounts/:id`: which of the caller's Oppenheimer bots
 * answers them on this number by default; null for none
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md` §1).
 */
export const updateWhatsappAccountSchema = z.object({
  answeringBotId: z.string().uuid().nullable(),
});

export type UpdateWhatsappAccountDto = z.infer<typeof updateWhatsappAccountSchema>;

/** How long the code sent to the owner's number can be entered. */
export const WHATSAPP_OWNER_CODE_TTL_MINUTES = 10;

/** Wrong codes allowed before a new one has to be asked for. */
export const WHATSAPP_OWNER_CODE_ATTEMPTS_MAX = 5;

/**
 * A phone number in international form, as a person types it: an optional
 * `+`, the country code and the number, 7 to 15 digits in all (E.164), with
 * spaces or dashes between them allowed.
 */
export const WHATSAPP_PHONE_PATTERN = /^\+?[1-9](?:[\s-]?\d){6,14}$/;

/** The digits of a number that matches `WHATSAPP_PHONE_PATTERN`: what its JID is made of. */
export function whatsappPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * `POST /whatsapp/accounts/:id/owner`: the owner's own number, which the
 * spare number sends a six-digit code to, to be entered in Settings.
 */
export const requestWhatsappOwnerSchema = z.object({
  phone: z.string().trim().regex(WHATSAPP_PHONE_PATTERN),
});

export type RequestWhatsappOwnerDto = z.infer<typeof requestWhatsappOwnerSchema>;

/** `POST /whatsapp/accounts/:id/owner/confirm`: the code the owner's number received. */
export const confirmWhatsappOwnerSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});

export type ConfirmWhatsappOwnerDto = z.infer<typeof confirmWhatsappOwnerSchema>;
