import { useLoadOlderBotMessages } from '@oppenheimer/frontend-consumer/react';
import { useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { ChatScroll } from '@/features/bots/hooks/use-sent-glide';

/** How far above the top of the pane the next page starts loading, so it is in before the reader gets there. */
const AHEAD_PX = 600;

/** Puts `box`'s foot `fromFoot` pixels below its view again. */
function keepFromFoot(box: HTMLElement, fromFoot: number): void {
  box.scrollTop = box.scrollHeight - fromFoot;
}

/**
 * A bot's history as the reader scrolls up into it: when the `top` of the
 * transcript (an element the chat puts before its first message) comes
 * within `AHEAD_PX` of the pane's view, the page older than it is read and
 * laid above. A page that leaves the top still in view (a run of routine
 * lines the chat hides) reads the next one, until the chat holds something
 * to show there or its first message. The reader stays on the line they
 * were reading as the page lands: the distance from the foot of the pane
 * is kept, which holds whether or not the browser's own scroll anchoring
 * moved them first. `firstId` is the oldest message the chat holds.
 */
export function useOlderOnScrollUp(botId: string, hasOlder: boolean, firstId: string | undefined) {
  const pane = useContext(ChatScroll);
  const { loadOlder, isPending, error } = useLoadOlderBotMessages(botId);
  const top = useRef<HTMLDivElement>(null);
  const fromFoot = useRef<number | null>(null);

  // Watches the top of the transcript come into view, DOM state outside React;
  // again for each page, whose first observation says whether the top still shows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: firstId is the re-run key, a page landed
  useEffect(() => {
    const sentinel = top.current;
    if (!hasOlder || !sentinel || typeof IntersectionObserver === 'undefined') return;
    const box = pane?.scroller.current ?? null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        if (box) fromFoot.current = box.scrollHeight - box.scrollTop;
        loadOlder();
      },
      { root: box, rootMargin: `${AHEAD_PX}px 0px 0px 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasOlder, firstId, loadOlder, pane]);

  // Keeps the reader's line in place once a page lands above it, before it is painted: the pane's scroll, DOM state.
  useLayoutEffect(() => {
    const box = pane?.scroller.current;
    const kept = fromFoot.current;
    if (!box || kept === null || firstId === undefined) return;
    fromFoot.current = null;
    keepFromFoot(box, kept);
  }, [firstId, pane]);

  return { top, loading: isPending, error };
}
