import { type ChannelTurnProps, channelTurn } from './bot-channel-turn.policy';
import { BotMessageEntity } from './bot-message.entity';
import { fenceUntrusted } from './bot-tool-text.policy';
import { BotTurnEntity } from './bot-turn.entity';

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

/** The most turns a contact's chat (a person or a group the number allows) is sent in an hour. */
export const WHATSAPP_CONTACT_TURNS_PER_HOUR = 20;

/** What a contact wrote in a chat the number allows, for the turn it queues. */
export interface BotWhatsappContactMessage {
  conversationId: string;
  whatsappAccountId: string;
  messageRowId: string;
  chatKind: 'direct' | 'group';
  chatName: string | null;
  senderName: string | null;
  /** Who wrote it, as their phone number (`+34600111222`), or their JID when it is no number. */
  sender: string;
  text: string;
}

/**
 * A contact's message as the bot reads it: who wrote it, and in which group,
 * then what they wrote, all inside one `<whatsapp>` fence, since every word
 * of it (their name and the group's included) is theirs, not the owner's.
 */
export function whatsappContactOpening(message: BotWhatsappContactMessage): string {
  const who = message.senderName ? `${message.senderName} (${message.sender})` : message.sender;
  const where =
    message.chatKind === 'group' ? ` in the group "${message.chatName ?? 'unnamed'}"` : '';
  return fenceUntrusted('whatsapp', `${who} wrote${where}:\n${message.text}`);
}

/**
 * The turn a contact's message queues: a contact's turn (`BotTurnEntity.contact`),
 * on the owner's account in the chat's own conversation, keyed by the stored
 * row as the owner's are, opened by what they wrote, fenced. It steers
 * nothing: a contact never reaches into a turn under way.
 */
export function whatsappContactTurn(
  props: ChannelTurnProps,
  message: BotWhatsappContactMessage,
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  const turn = BotTurnEntity.queue({
    ...props,
    conversationId: message.conversationId,
    origin: 'whatsapp',
    lane: 'owner',
    sourceKey: whatsappSourceKey(message),
    contact: true,
  });
  const opening = BotMessageEntity.createNew({
    organizationId: props.organizationId,
    botId: props.botId,
    conversationId: message.conversationId,
    turnId: turn.id,
    role: 'user',
    content: whatsappContactOpening(message),
    steps: [],
    position: 0,
  });
  return { turn, opening };
}
