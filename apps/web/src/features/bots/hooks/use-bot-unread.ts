import { useEffect, useSyncExternalStore } from 'react';
import { botUnread } from '../lib/bot-unread';

/** One row's unread mark, and the mark; re-renders when it changes, whoever wrote it. */
export function useBotUnread(id: string) {
  const unread = useSyncExternalStore(botUnread.subscribe, () => botUnread.has(id));
  return { unread, setUnread: (next: boolean) => botUnread.set(id, next) };
}

/**
 * Opening a bot's chat takes its unread mark off, wherever it is open (its
 * page, a section, beside a session). Keyed on the bot alone: one marked while
 * its chat is open keeps the mark until the reader comes back to it.
 */
export function useClearBotUnreadOnOpen(botId: string): void {
  // Syncs the device's unread marks (localStorage) with the chat on screen.
  useEffect(() => botUnread.set(botId, false), [botId]);
}
