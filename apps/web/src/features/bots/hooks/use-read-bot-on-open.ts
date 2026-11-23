import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useAcknowledgeBot, useBotWaitingOnYou } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useRef } from 'react';

/**
 * The open chat is read, as an open session's report is: while it is drawn
 * and the tab is in front, a bot with a message the person has not read (the
 * sidebar's green unread badge) or that waits on them (a failed turn's needs-input badge) is
 * acknowledged, at once or when the reader comes back to the tab, on every
 * device. One try per bot and last message; coming back to the tab tries a
 * failed read again, so an API that is down is not asked in a loop.
 */
export function useReadBotOnOpen(bot: Pick<BotEntity, 'id' | 'unread' | 'lastActivityAt'>): void {
  const { mutate } = useAcknowledgeBot();
  const waiting = useBotWaitingOnYou(bot.id);
  const tried = useRef<string | null>(null);
  const { id } = bot;
  const key =
    bot.unread || waiting ? `${id}:${bot.lastActivityAt.getTime()}:${String(waiting)}` : null;

  useEffect(() => {
    if (!key) return;
    // Syncs the API's read mark with the chat on screen, and the tab's visibility.
    const read = () => {
      if (document.visibilityState !== 'visible') tried.current = null;
      else if (tried.current !== key) {
        tried.current = key;
        mutate(id);
      }
    };
    read();
    document.addEventListener('visibilitychange', read);
    return () => document.removeEventListener('visibilitychange', read);
  }, [id, key, mutate]);
}
