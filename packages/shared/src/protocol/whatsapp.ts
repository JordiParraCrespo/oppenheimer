import { z } from 'zod/v4';
import { commandIdSchema } from './primitives.js';

/**
 * WhatsApp on the link: the messages behind the `whatsapp` capability. A runner
 * that names it holds one WhatsApp linked device — OpenClaw's route, the
 * WhatsApp Web multi-device protocol, a number the owner has — and its keys
 * never leave the host. The control plane asks it to pair, unpair and send; the
 * runner tells it how the device stands and hands it each message that arrives,
 * which the control plane keeps so the owner's bots can read the chats. Part of
 * `protocolMessageSchema`, which is where every kind is listed.
 */

/** How many messages one `whatsapp.messages` carries at most. */
export const WHATSAPP_BATCH_MAX_MESSAGES = 50;

/**
 * The longest text one message carries on the link, in characters. WhatsApp
 * allows more; a longer one is cut on the host with a note, so one pasted
 * essay cannot fill a frame.
 */
export const WHATSAPP_TEXT_MAX_CHARS = 8_000;

/**
 * How many people one reported message names as mentioned at most; a runner
 * keeps the first ones of a message that names more.
 */
export const WHATSAPP_MENTIONS_MAX = 64;

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
 * `command.failed`: `WA_001` the host already holds a device.
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

/**
 * What a message carries besides its text. Only the kind is sent: media stays
 * on the phone, except a voice note the control plane asks for
 * (`whatsapp.media.get`).
 */
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
  /**
   * Who wrote the message `quotedId` names, by phone number when the runner
   * knows it, as `senderId` is. A reply to the linked number is one of the
   * two things that wake a bot in a group. A runner from before it sends
   * none.
   */
  quotedSenderId: jid().optional(),
  /**
   * Whom the message @-mentions, by phone number when known, as `senderId`
   * is: a mention of the linked number wakes a bot in a group. A runner from
   * before it sends none.
   */
  mentions: z.array(jid()).max(WHATSAPP_MENTIONS_MAX).optional(),
  /**
   * How long a voice note runs, in seconds, as WhatsApp gives it. Only on a
   * voice note a runner can hand over (`whatsapp.voice`); a runner from
   * before it sends none, and its voice notes stay `[audio]`.
   */
  voiceSeconds: z.number().int().min(0).max(86_400).optional(),
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
 * `WA_002` no device is connected, `WA_003` WhatsApp refused it,
 * `WA_004` the host's own send budget is spent.
 */
export const whatsappSendSchema = z.object({
  type: z.literal('whatsapp.send'),
  commandId: commandIdSchema,
  chatId: jid(),
  text: z.string().min(1).max(WHATSAPP_TEXT_MAX_CHARS),
  /**
   * The message this one answers, shown quoted above it: its WhatsApp id
   * and who wrote it. Optional, so a runner from before it sends the text
   * unquoted: the link only grows.
   */
  replyTo: z
    .object({
      id: z.string().min(1).max(128),
      senderId: jid(),
    })
    .optional(),
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

/**
 * The largest voice note `whatsapp.media` carries, in bytes before base64:
 * one frame under `LINK_MAX_FRAME_BYTES` with room for its envelope. A
 * WhatsApp voice note is Ogg/Opus at about 16 kbit/s, so this is two minutes
 * and more; a longer one is refused (`WA_006`) rather than split.
 */
export const WHATSAPP_VOICE_NOTE_MAX_BYTES = 352 * 1024;

/**
 * Hand over a voice note the number received, to be transcribed. The runner
 * keeps what it needs to fetch one (the message's media key and path, never
 * the audio) for `WHATSAPP_VOICE_NOTE_KEPT_HOURS`, and downloads it from
 * WhatsApp only when asked. Answered by `whatsapp.media` with the same
 * `commandId`, or `command.failed`: `WA_002` no device is connected, `WA_005`
 * no voice note the host still knows by that id, `WA_006` it is larger than
 * `WHATSAPP_VOICE_NOTE_MAX_BYTES`, `WA_007` WhatsApp would not hand it over.
 * Sent only to a runner that names `whatsapp.voice`.
 */
export const whatsappMediaGetSchema = z.object({
  type: z.literal('whatsapp.media.get'),
  commandId: commandIdSchema,
  chatId: jid(),
  /** WhatsApp's id of the voice note's message. */
  messageId: z.string().min(1).max(128),
});

export type WhatsappMediaGetMessage = z.infer<typeof whatsappMediaGetSchema>;

/** How long a runner can still fetch a voice note it received. */
export const WHATSAPP_VOICE_NOTE_KEPT_HOURS = 48;

/** A voice note, as WhatsApp stored it: decrypted, in its own container. */
export const whatsappMediaSchema = z.object({
  type: z.literal('whatsapp.media'),
  commandId: commandIdSchema,
  /** WhatsApp's MIME type for it: `audio/ogg; codecs=opus` for a voice note. */
  mimetype: z.string().min(1).max(128),
  /** The bytes, base64. */
  data: z
    .string()
    .min(1)
    .max(Math.ceil(WHATSAPP_VOICE_NOTE_MAX_BYTES / 3) * 4),
});

export type WhatsappMediaMessage = z.infer<typeof whatsappMediaSchema>;
