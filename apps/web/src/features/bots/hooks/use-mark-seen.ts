import { useMarkBotSeen } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useEffectEvent } from 'react';

/**
 * Tells the API the owner is in this bot's chat (`26-bot-routines.md` §6, the
 * spend guard): when the chat opens, and again when its tab comes back into
 * view. That is what starts again the routines the bot paused while they
 * were away. The API writes it at most once a minute, so a tab that flickers
 * costs nothing; a failure is not the reader's to see.
 */
export function useMarkSeen(botId: string): void {
  const { mutate } = useMarkBotSeen();
  const mark = useEffectEvent(() => mutate({ id: botId }));

  // An effect, not a handler: being in the chat is no click. Visibility,
  // because a chat left open in a background tab is not being read. Once per
  // mount: the chat is keyed by its bot (`BotChatRoute`), so another bot is
  // another mount.
  useEffect(() => {
    if (document.visibilityState === 'visible') mark();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') mark();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
}
