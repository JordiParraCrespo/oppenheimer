import { type ChannelTurnProps, channelTurn } from './bot-channel-turn.policy';
import type { BotMessageEntity } from './bot-message.entity';
import type { BotTurnEntity } from './bot-turn.entity';

/** What a message of the owner's on WhatsApp is, for the turn it queues. */
export interface BotWhatsappMessage {
  /** The conversation the WhatsApp chat is in with the bot. */
  conversationId: string;
  /** The linked number it came through. */
  whatsappAccountId: string;
  /** The stored `whatsapp_message` row: the turn's key, and what the reply quotes. */
  messageRowId: string;
  /** What the owner wrote, without a switch's "Name:" prefix. */
  text: string;
  /** An uncaptioned voice note: `text` is ignored, and the turn reads the note when it starts. */
  voiceNote: boolean;
}

/**
 * What a turn on the owner's uncaptioned voice note shows until the turn
 * reads the note, which its opening's `pendingMedia` says it must: never
 * matched on, so the owner typing it changes nothing. Queued with this rather
 * than heard first, so the turn takes its place among the owner's messages
 * at once, in the order they were sent.
 */
export const WHATSAPP_VOICE_NOTE_OPENING = '[voice note]';

/**
 * The key that makes the owner's WhatsApp message one turn however often it
 * is delivered: the stored message's own row, never the conversation, which
 * a `/new` or a switch in between would change. WhatsApp's own ids are up to
 * 128 characters and so is a chat's JID, so the key names the row (unique,
 * and the same on every delivery) to stay inside `bot_turn."sourceKey"`.
 */
export function whatsappSourceKey(message: {
  whatsappAccountId: string;
  messageRowId: string;
}): string {
  return `whatsapp:${message.whatsappAccountId}:${message.messageRowId}`;
}

/** The stored WhatsApp message a turn answers, from its key; null for a turn that answers none. */
export function whatsappMessageRowIdOf(sourceKey: string | null): string | null {
  return whatsappMessageOf(sourceKey)?.messageRowId ?? null;
}

/** The number and the stored message a turn answers, from its key; null for a turn that answers none. */
export function whatsappMessageOf(
  sourceKey: string | null,
): { whatsappAccountId: string; messageRowId: string } | null {
  const match = /^whatsapp:([0-9a-f-]{36}):([0-9a-f-]{36})$/.exec(sourceKey ?? '');
  return match?.[1] && match[2] ? { whatsappAccountId: match[1], messageRowId: match[2] } : null;
}

/** The turn the owner's message on WhatsApp queues, in the chat's own conversation. */
export function whatsappTurn(
  props: ChannelTurnProps,
  message: BotWhatsappMessage,
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  return channelTurn(props, {
    origin: 'whatsapp',
    sourceKey: whatsappSourceKey(message),
    conversationId: message.conversationId,
    text: message.voiceNote ? WHATSAPP_VOICE_NOTE_OPENING : message.text,
    pendingMedia: message.voiceNote ? { kind: 'whatsapp_voice_note' } : null,
  });
}
