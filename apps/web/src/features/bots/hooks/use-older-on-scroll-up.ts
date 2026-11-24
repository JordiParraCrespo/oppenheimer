import { useLoadOlderBotMessages } from '@oppenheimer/frontend-consumer/react';
import { useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { ChatScroll } from '@/features/bots/hooks/use-sent-glide';

/** How far above the top of the pane the next page starts loading, so it is in before the reader gets there. */
const AHEAD_PX = 600;

/** The line the reader is on, and how far below the top of the pane it sits. */
interface ReadingLine {
  line: Element;
  offset: number;
}

function offsetIn(box: HTMLElement, line: Element): number {
  return line.getBoundingClientRect().top - box.getBoundingClientRect().top;
}

/** The transcript's first line still in view: the one the reader is on. */
function lineInView(box: HTMLElement, transcript: Element | null): ReadingLine | null {
  const top = box.getBoundingClientRect().top;
  for (const line of transcript?.children ?? []) {
    if (line.getBoundingClientRect().bottom > top) return { line, offset: offsetIn(box, line) };
  }
  return null;
}

/** Scrolls `box` so `reading.line` is back where it was. */
function keepLine(box: HTMLElement, reading: ReadingLine): void {
  box.scrollTop += offsetIn(box, reading.line) - reading.offset;
}

/**
 * A bot's history as the reader scrolls up into it: when the `top` of the
 * transcript (an element just before it) comes within `AHEAD_PX` of the
 * pane's view, the page older than it is read and laid above. A page that
 * leaves the top still in view (a run of routine lines the chat hides)
 * reads the next one, until the chat holds something to show there or its
 * first message.
 *
 * The reader stays on the line they were reading: it is noted when the read
 * starts, its place follows their own scrolling while the read is out, and
 * whatever lands above it (the loading line, then the page) is scrolled
 * away under them. That holds whether or not the browser's own scroll
 * anchoring moved them first, and whatever streams in below. `firstId` is
 * the oldest message the chat holds.
 */
export function useOlderOnScrollUp(botId: string, hasOlder: boolean, firstId: string | undefined) {
  const pane = useContext(ChatScroll);
  const { loadOlder, isPending, error } = useLoadOlderBotMessages(botId);
  const top = useRef<HTMLDivElement>(null);
  const reading = useRef<ReadingLine | null>(null);

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
        if (box) reading.current = lineInView(box, sentinel.nextElementSibling);
        loadOlder();
      },
      { root: box, rootMargin: `${AHEAD_PX}px 0px 0px 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasOlder, firstId, loadOlder, pane]);

  // Follows the reader's own scrolling while a page is out, a DOM listener.
  useEffect(() => {
    const box = pane?.scroller.current;
    if (!box) return;
    const onScroll = () => {
      const held = reading.current;
      if (held?.line.isConnected) held.offset = offsetIn(box, held.line);
    };
    box.addEventListener('scroll', onScroll, { passive: true });
    return () => box.removeEventListener('scroll', onScroll);
  }, [pane]);

  // Puts the reader's line back before paint as the loading line and the page land above it: the pane's scroll, DOM state.
  // biome-ignore lint/correctness/useExhaustiveDependencies: firstId is the re-run key, a page landed
  useLayoutEffect(() => {
    const box = pane?.scroller.current;
    const held = reading.current;
    if (!box || !held) return;
    if (held.line.isConnected) keepLine(box, held);
    if (!isPending) reading.current = null;
  }, [firstId, isPending, pane]);

  return { top, loading: isPending, error };
}
