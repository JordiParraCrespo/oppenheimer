import type { InboxDeckExit } from '@oppenheimer/design-system-web';
import { useEffect, useRef, useState } from 'react';

/** How long the card in hand takes to leave: the deck's base duration. */
const EXIT_MS = 220;
/** How long a card that should have left may stay before it is drawn in place again. */
const STUCK_MS = 1200;

/** Sends the item `key` off the deck the `exit` way, then does `then` (marks it, moves on). */
export type InboxPutAway = (key: string, exit: InboxDeckExit, then: () => void) => void;

/**
 * The card in hand and the way it is leaving. `putAway` draws the card
 * going off (right for done, left for the next) and does the
 * action once it has gone, so the next card rises in its place; with reduced
 * motion it does it at once. One card leaves at a time. A card the action
 * did not take away (a refused write) settles back after a moment. Syncs
 * with the browser's timers, cleared on unmount.
 */
export function useInboxDeck(itemKey: string | null) {
  const [away, setAway] = useState<{ key: string; exit: InboxDeckExit } | null>(null);
  const timers = useRef<number[]>([]);
  const leavingKey = useRef<string | null>(null);
  const [putAway] = useState(() => {
    const send: InboxPutAway = (key, exit, then) => {
      if (leavingKey.current === key) return;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        then();
        return;
      }
      leavingKey.current = key;
      setAway({ key, exit });
      timers.current.push(
        window.setTimeout(() => {
          then();
          timers.current.push(
            window.setTimeout(() => {
              leavingKey.current = null;
              setAway((now) => (now?.key === key ? null : now));
            }, STUCK_MS),
          );
        }, EXIT_MS),
      );
    };
    return send;
  });
  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
    },
    [],
  );

  return { leaving: away && away.key === itemKey ? away.exit : null, putAway };
}
