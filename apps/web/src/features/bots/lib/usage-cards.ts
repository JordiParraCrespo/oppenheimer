/**
 * Which bots' chats show the usage card (`/usage`, `25-bots.md` §4.1): it is
 * the console's alone, never a message, so it lives here and not in the
 * conversation, until it is closed or the tab goes. A store outside React
 * because the composer opens it and the chat column draws it.
 */

const open = new Set<string>();
const listeners = new Set<(botId: string) => void>();

export function usageCardOpen(botId: string): boolean {
  return open.has(botId);
}

export function openUsageCard(botId: string): void {
  open.add(botId);
  for (const listener of listeners) listener(botId);
}

export function closeUsageCard(botId: string): void {
  if (!open.delete(botId)) return;
  for (const listener of listeners) listener(botId);
}

export function subscribeUsageCards(listener: (botId: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
