import type { TelegramAccountStatus } from '@oppenheimer/shared';
import type { TelegramChat } from './telegram-message.types';

/** Why a bot's message cannot go now; null when it can. */
export type TelegramSendRefusal = 'not_connected' | 'limit_reached' | null;

/**
 * Whether a bot may send through a Telegram bot now: only while the host is
 * polling it, and only under the day's share (`TELEGRAM_SENDS_PER_DAY`). The
 * host paces sends to Telegram's own limits on top (`telegram.md` §3).
 */
export function telegramSendRefusal(
  status: TelegramAccountStatus,
  sentToday: number,
  perDay: number,
): TelegramSendRefusal {
  if (status !== 'connected') return 'not_connected';
  if (sentToday >= perDay) return 'limit_reached';
  return null;
}

/**
 * The one chat a bot means: its id exactly, a person's `@username`, or else
 * the one chat whose name (a person, a group) matches what it wrote, ignoring
 * case. A name two chats share is no answer: the bot is told to use the id.
 */
export function pickTelegramChat(
  chats: readonly TelegramChat[],
  wanted: string,
): TelegramChat | 'ambiguous' | null {
  const target = wanted.trim();
  const byId = chats.find((chat) => chat.chatId === target);
  if (byId) return byId;
  const lowered = target.toLowerCase();
  if (lowered.startsWith('@')) {
    const handle = lowered.slice(1);
    const byHandle = chats.filter(
      (chat) => chat.chatKind === 'direct' && chat.handle?.toLowerCase() === handle,
    );
    if (byHandle.length === 1) return byHandle[0] ?? null;
  }
  const named = chats.filter((chat) => chat.chatName?.toLowerCase() === lowered);
  if (named.length === 1) return named[0] ?? null;
  if (named.length > 1) return 'ambiguous';
  const partial = chats.filter((chat) => chat.chatName?.toLowerCase().includes(lowered));
  if (partial.length === 1) return partial[0] ?? null;
  return partial.length > 1 ? 'ambiguous' : null;
}
