import { type RefObject, useEffect, useRef, useState } from 'react';

/** How close to the bottom counts as reading the latest, in pixels. */
const NEAR_BOTTOM_PX = 80;

/**
 * Keeps a scrolling chat on its latest line while the reader is there: when
 * what is inside `content` grows (a message lands, a reply streams) or the
 * `scroller` shrinks (the composer grows a line, the window does) and the
 * reader was at the bottom, it follows them down. Someone who scrolled up to
 * read stays where they are, and `atLatest` turns false so the chat can offer
 * the way back (`toLatest`, a smooth scroll that pins again). Only the reader
 * moving up unpins: a smooth scroll down passes through positions far from
 * the end, and a turn may have grown past the margin by the time this hook's
 * own scroll is reported.
 *
 * `repin` lets a chat pin again on something it can see in the content (a
 * message the reader just sent): it is read once, called when the hook starts
 * watching and on every resize, and a `true` pins. Between `hold(true)` and
 * `hold(false)` something else owns the scroll (an animation of the chat's
 * own) and this hook does not follow. The first layout opens at the bottom.
 */
export function useStickToBottom({ repin }: { repin?: (content: HTMLElement) => boolean } = {}): {
  scroller: RefObject<HTMLDivElement | null>;
  content: RefObject<HTMLDivElement | null>;
  hold: (owning: boolean) => void;
  atLatest: boolean;
  toLatest: () => void;
} {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const held = useRef(false);
  const repinRef = useRef(repin);
  const [atLatest, setAtLatest] = useState(true);

  // Watches the content's and the scroller's size and the reader's scroll, DOM state outside React.
  useEffect(() => {
    const box = scroller.current;
    const inner = content.current;
    if (!box || !inner || typeof ResizeObserver === 'undefined') return;
    const shouldRepin = repinRef.current;
    let lastTop = box.scrollTop;
    const near = () => box.scrollHeight - box.scrollTop - box.clientHeight < NEAR_BOTTOM_PX;
    const onScroll = () => {
      if (box.scrollTop < lastTop) pinned.current = near();
      else if (near()) pinned.current = true;
      lastTop = box.scrollTop;
      setAtLatest(pinned.current || near());
    };
    const observer = new ResizeObserver(() => {
      if (shouldRepin?.(inner)) pinned.current = true;
      if (pinned.current && !held.current) box.scrollTop = box.scrollHeight;
      setAtLatest(pinned.current || near());
    });
    shouldRepin?.(inner);
    box.addEventListener('scroll', onScroll, { passive: true });
    observer.observe(inner);
    observer.observe(box);
    box.scrollTop = box.scrollHeight;
    return () => {
      box.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, []);

  const hold = (owning: boolean) => {
    held.current = owning;
  };

  const toLatest = () => {
    const box = scroller.current;
    if (!box) return;
    pinned.current = true;
    setAtLatest(true);
    const instant = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    box.scrollTo({ top: box.scrollHeight, behavior: instant ? 'auto' : 'smooth' });
  };

  return { scroller, content, hold, atLatest, toLatest };
}
