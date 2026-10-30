import { z } from 'zod/v4';
import { commandIdSchema } from './primitives.js';

/**
 * WhatsApp on the link (`product/next-steps/whatsapp.md`): the messages behind
 * the `whatsapp` capability. A runner that names it holds one WhatsApp linked
 * device — OpenClaw's route, the WhatsApp Web multi-device protocol, a number
 * the owner has — and its keys never leave the host. The control plane asks
 * it to pair, unpair and send; the runner tells it how the device stands and
 * hands it each message that arrives, which the control plane keeps so the
 * owner's bots can read the chats. Part of `protocolMessageSchema`, which is
 * where every kind is listed.
 */

/** How many messages one `whatsapp.messages` carries at most. */
export const WHATSAPP_BATCH_MAX_MESSAGES = 50;

/**
 * The longest text one message carries on the link, in characters. WhatsApp
 * allows more; a longer one is cut on the host with a note, so one pasted
 * essay cannot fill a frame.
 */
export const WHATSAPP_TEXT_MAX_CHARS = 8_000;

/** A WhatsApp JID (`34600111222@s.whatsapp.net`, `1203…@g.us`). A fresh schema per use. */
const jid = () => z.string().min(3).max(128);

/** A name WhatsApp gives a chat or a person: a push name, a contact, a group subject. */
const displayName = () => z.string().min(1).max(200);

/** How the linked device stands, as the runner sees it. */
export const WHATSAPP_DEVICE_STATES = [
  /** No device: never paired, or unpaired from the console. */
  'unlinked',
  /** Waiting for the phone to scan `qr`. */
  'pairing',
  /** Paired, and the socket to WhatsApp is not up yet (or is reconnecting). */
  'connecting',
  /** Paired and online: messages flow both ways. */
  'connected',
  /** The phone removed the device, or WhatsApp logged it out: pair again. */
  'logged_out',
] as const;
export type WhatsappDeviceState = (typeof WHATSAPP_DEVICE_STATES)[number];

/**
 * Pair a new linked device. The runner answers with `whatsapp.state` frames:
 * `pairing` with each QR code WhatsApp issues (one every twenty seconds or
 * so, while the pairing window lasts), then `connected` once the phone has
 * scanned one, or `unlinked` when the window closed unscanned. Refused with
 * `command.failed`: `WHATSAPP_001` the host already holds a device.
 */
export const whatsappLinkSchema = z.object({
  type: z.literal('whatsapp.link'),
  commandId: commandIdSchema,
});

export type WhatsappLinkMessage = z.infer<typeof whatsappLinkSchema>;

/**
 * Log the device out of WhatsApp and delete its keys from the host. Answered
 * with `whatsapp.state` `unlinked`; a host with no device answers the same.
 */
export const whatsappUnlinkSchema = z.object({
  type: z.literal('whatsapp.unlink'),
  commandId: commandIdSchema,
});

export type WhatsappUnlinkMessage = z.infer<typeof whatsappUnlinkSchema>;

/**
 * How the device stands. Sent after every hello, on every change, and in
 * answer to `whatsapp.link` and `whatsapp.unlink`. The control plane keeps the
 * last one on the host's account; it is a state, not an event, so a lost one
 * is replaced by the next.
 */
export const whatsappStateSchema = z.object({
  type: z.literal('whatsapp.state'),
  state: z.enum(WHATSAPP_DEVICE_STATES),
  /** The QR code's text while `pairing`, which the console draws. */
  qr: z.string().min(1).max(1024).optional(),
  /** When `qr` stops being valid. */
  qrExpiresAt: z.iso.datetime().optional(),
  /** The paired number's JID, once paired. */
  phone: jid().optional(),
  /** The paired account's own WhatsApp name, once known. */
  name: displayName().optional(),
  /** Why the device is `logged_out` or `unlinked`, in the runner's words. */
  reason: z.string().max(200).optional(),
});

export type WhatsappStateMessage = z.infer<typeof whatsappStateSchema>;

/** What a message carries besides its text. Only the kind is sent: media stays on the phone. */
export const WHATSAPP_MEDIA_KINDS = [
  'image',
  'video',
  'audio',
  'document',
  'sticker',
  'contact',
  'location',
] as const;
export type WhatsappMediaKind = (typeof WHATSAPP_MEDIA_KINDS)[number];

/**
 * One message, as the runner turns WhatsApp's into the shape the control
 * plane keeps. Messages the owner sends from their phone come too
 * (`fromMe`), so a bot reads the conversation as the owner sees it.
 */
export const whatsappInboundSchema = z.object({
  /** The runner's outbox key for it, which `whatsapp.ack` names. */
  key: z.string().min(1).max(256),
  /** WhatsApp's message id, unique within its chat. */
  id: z.string().min(1).max(128),
  chatId: jid(),
  chatKind: z.enum(['direct', 'group']),
  /** The group's subject, or the other person's name in a direct chat. */
  chatName: displayName().optional(),
  senderId: jid(),
  senderName: displayName().optional(),
  fromMe: z.boolean(),
  /** The text, or a media message's caption; empty for media with none. */
  text: z.string().max(WHATSAPP_TEXT_MAX_CHARS),
  media: z.enum(WHATSAPP_MEDIA_KINDS).optional(),
  /** The message it replies to, when it quotes one. */
  quotedId: z.string().min(1).max(128).optional(),
  sentAt: z.iso.datetime(),
});

export type WhatsappInbound = z.infer<typeof whatsappInboundSchema>;

/**
 * Messages that arrived, oldest first. The runner keeps each on disk until
 * the control plane acknowledges it, so a link that drops loses none, and it
 * resends what is unacknowledged on the next link. Messages from before the
 * device was paired are never sent: no history sync.
 */
export const whatsappMessagesSchema = z.object({
  type: z.literal('whatsapp.messages'),
  messages: z.array(whatsappInboundSchema).min(1).max(WHATSAPP_BATCH_MAX_MESSAGES),
});

export type WhatsappMessagesMessage = z.infer<typeof whatsappMessagesSchema>;

/** The control plane stored these messages; the runner forgets them. */
export const whatsappAckSchema = z.object({
  type: z.literal('whatsapp.ack'),
  keys: z.array(z.string().min(1).max(256)).min(1).max(WHATSAPP_BATCH_MAX_MESSAGES),
});

export type WhatsappAckMessage = z.infer<typeof whatsappAckSchema>;

/**
 * Send a text message to one chat, as the paired number. Answered by
 * `whatsapp.sent` with the same `commandId`, or `command.failed`:
 * `WHATSAPP_002` no device is connected, `WHATSAPP_003` WhatsApp refused it,
 * `WHATSAPP_004` the host's own send budget is spent.
 */
export const whatsappSendSchema = z.object({
  type: z.literal('whatsapp.send'),
  commandId: commandIdSchema,
  chatId: jid(),
  text: z.string().min(1).max(WHATSAPP_TEXT_MAX_CHARS),
});

export type WhatsappSendMessage = z.infer<typeof whatsappSendSchema>;

/** WhatsApp took the message: its id and when it was sent. */
export const whatsappSentSchema = z.object({
  type: z.literal('whatsapp.sent'),
  commandId: commandIdSchema,
  id: z.string().min(1).max(128),
  sentAt: z.iso.datetime(),
});

export type WhatsappSentMessage = z.infer<typeof whatsappSentSchema>;
