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
  linkedAt: z.string(),
});

export type WhatsappAccount = z.infer<typeof whatsappAccountSchema>;
