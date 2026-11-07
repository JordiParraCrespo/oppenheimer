import { useMarkBotSeen } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useEffectEvent } from 'react';

/** The least time between two "still here"s while the owner is active in the chat. */
const STILL_HERE_MS = 60 * 1000;

/** What a person in the chat does: a key, the pointer, a scroll, the window's focus. */
const ACTIVITY = ['keydown', 'pointerdown', 'pointermove', 'wheel', 'focus'] as const;

/**
 * Tells the API the owner is in this bot's chat (`26-bot-routines.md` §6, the
 * spend guard): when the chat opens, when its tab comes back into view, and
 * at most once a minute while they are active in it, so what a routine says
 * while they read counts as read. A tab merely left open is no reader: with
 * nobody at it, the routines stop as if the chat were closed. Each one also
 * starts again the routines the bot paused while they were away; a failure
 * is not the reader's to see.
 */
export function useMarkSeen(botId: string): void {
  const { mutate } = useMarkBotSeen();
  const mark = useEffectEvent(() => {
    if (document.visibilityState === 'visible') mutate({ id: botId });
  });

  // An effect, not a handler: being in the chat is no single click. Once per
  // mount: the chat is keyed by its bot (`BotChatRoute`), so another bot is
  // another mount.
  useEffect(() => {
    let last = Date.now();
    let trailing: number | undefined;
    const arrive = () => {
      window.clearTimeout(trailing);
      trailing = undefined;
      last = Date.now();
      mark();
    };
    // Activity inside the minute is said at its end, so none of it goes unrecorded.
    const active = () => {
      const wait = STILL_HERE_MS - (Date.now() - last);
      if (wait <= 0) return arrive();
      trailing ??= window.setTimeout(arrive, wait);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') arrive();
    };
    arrive();
    document.addEventListener('visibilitychange', onVisibility);
    for (const type of ACTIVITY) window.addEventListener(type, active, { passive: true });
    return () => {
      window.clearTimeout(trailing);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const type of ACTIVITY) window.removeEventListener(type, active);
    };
  }, []);
}
