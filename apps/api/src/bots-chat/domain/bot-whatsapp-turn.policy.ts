import { BotMessageEntity } from './bot-message.entity';
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
}

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
  const match = /^whatsapp:[0-9a-f-]{36}:([0-9a-f-]{36})$/.exec(sourceKey ?? '');
  return match?.[1] ?? null;
}

/**
 * The turn the owner's message on WhatsApp queues
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md` §3): in the
 * owner lane, as the owner, in the WhatsApp chat's own conversation, opened
 * by what they wrote as their message. It is the owner's own direct chat
 * with their number, so it is theirs as a console message is: the bot's
 * tools and memory.
 */
export function whatsappTurn(
  props: Omit<
    Parameters<typeof BotTurnEntity.queue>[0],
    'origin' | 'sourceKey' | 'lane' | 'conversationId'
  >,
  message: BotWhatsappMessage,
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  const turn = BotTurnEntity.queue({
    ...props,
    conversationId: message.conversationId,
    origin: 'whatsapp',
    lane: 'owner',
    sourceKey: whatsappSourceKey(message),
  });
  const opening = BotMessageEntity.createNew({
    organizationId: props.organizationId,
    botId: props.botId,
    conversationId: message.conversationId,
    turnId: turn.id,
    role: 'user',
    content: message.text,
    steps: [],
    position: 0,
  });
  return { turn, opening };
}
