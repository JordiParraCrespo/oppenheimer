import { useLayoutEffect, useSyncExternalStore } from 'react';
import { botSeen } from '../lib/bot-seen';

/** When the reader last saw the bot's chat on this device; re-renders when it changes, whoever wrote it. */
export function useBotSeenAt(id: string): number {
  return useSyncExternalStore(botSeen.subscribe, () => botSeen.at(id));
}

/**
 * An open chat marks its bot seen up to its latest message, and again each
 * time a newer one lands while it stays open, wherever it is open (its page,
 * a section, beside a session). Before paint, so the row of the chat on
 * screen never shows a dot for a message the reader is looking at.
 */
export function useMarkBotSeen(id: string, lastActivityAt: Date): void {
  const at = lastActivityAt.getTime();
  // Syncs the device's seen marks (localStorage) with the chat on screen.
  useLayoutEffect(() => botSeen.mark(id, at), [id, at]);
}
