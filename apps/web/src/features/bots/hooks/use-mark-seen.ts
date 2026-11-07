import { useMarkBotSeen } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useEffectEvent } from 'react';

/** How often an open, visible chat says the owner is still in it. */
const STILL_HERE_MS = 5 * 60 * 1000;

/**
 * Tells the API the owner is in this bot's chat (`26-bot-routines.md` §6, the
 * spend guard): when the chat opens, when its tab comes back into view, and
 * every few minutes while it stays in view, so what a routine says into an
 * open chat counts as read. That is also what starts again the routines the
 * bot paused while they were away. The API writes it at most once a minute;
 * a failure is not the reader's to see.
 */
export function useMarkSeen(botId: string): void {
  const { mutate } = useMarkBotSeen();
  const mark = useEffectEvent(() => {
    if (document.visibilityState === 'visible') mutate({ id: botId });
  });

  // An effect, not a handler: being in the chat is no click. Visibility,
  // because a chat left open in a background tab is not being read. Once per
  // mount: the chat is keyed by its bot (`BotChatRoute`), so another bot is
  // another mount.
  useEffect(() => {
    const still = () => mark();
    still();
    document.addEventListener('visibilitychange', still);
    const timer = window.setInterval(still, STILL_HERE_MS);
    return () => {
      document.removeEventListener('visibilitychange', still);
      window.clearInterval(timer);
    };
  }, []);
}
