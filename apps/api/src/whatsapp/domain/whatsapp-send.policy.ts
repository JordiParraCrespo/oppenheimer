import type { WhatsappAccountStatus } from '@oppenheimer/shared';
import type { WhatsappChat } from './whatsapp-message.types';

/** Why a bot's message cannot go now; null when it can. */
export type WhatsappSendRefusal = 'not_connected' | 'limit_reached' | null;

/**
 * Whether a bot may send from a number now: only while its device is
 * connected, and only under the day's share (`WHATSAPP_SENDS_PER_DAY`). The
 * host keeps a budget of its own on top, per minute and per day, because a
 * linked device has no published limit and the cost of going over is the
 * number (OpenClaw keeps none; we keep both).
 */
export function whatsappSendRefusal(
  status: WhatsappAccountStatus,
  sentToday: number,
  perDay: number,
): WhatsappSendRefusal {
  if (status !== 'connected') return 'not_connected';
  if (sentToday >= perDay) return 'limit_reached';
  return null;
}

/**
 * The one chat a bot means: its id exactly, or else the one chat whose name
 * (a person, a group) matches what it wrote, ignoring case. A name two chats
 * share is no answer: the bot is told to use the id.
 */
export function pickWhatsappChat(
  chats: readonly WhatsappChat[],
  wanted: string,
): WhatsappChat | 'ambiguous' | null {
  const target = wanted.trim();
  const byId = chats.find((chat) => chat.chatId === target);
  if (byId) return byId;
  const lowered = target.toLowerCase();
  const named = chats.filter((chat) => chat.chatName?.toLowerCase() === lowered);
  if (named.length === 1) return named[0] ?? null;
  if (named.length > 1) return 'ambiguous';
  const partial = chats.filter((chat) => chat.chatName?.toLowerCase().includes(lowered));
  if (partial.length === 1) return partial[0] ?? null;
  return partial.length > 1 ? 'ambiguous' : null;
}
