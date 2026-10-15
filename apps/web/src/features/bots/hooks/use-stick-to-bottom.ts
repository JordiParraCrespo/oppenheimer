import { type RefObject, useEffect, useRef, useState } from 'react';

/** How close to the bottom counts as reading the latest, in pixels. */
const NEAR_BOTTOM_PX = 80;

/** A message you sent: one more of these means you are waiting on the answer. */
const SENT_MESSAGE = '[data-slot="chat-user-message"]';

/**
 * Keeps a scrolling chat on its latest line while the reader is there: when
 * what is inside `content` grows (a message lands, a reply streams) and the
 * reader was at the bottom, `scroller` follows it down. Someone scrolled up
 * to read stays where they are, and `atLatest` turns false so the chat can
 * offer the way back (`toLatest`, a smooth scroll that pins again). Sending a
 * message pins it too: you want to see the answer to what you just asked.
 * The first layout opens at the bottom.
 */
export function useStickToBottom(): {
  scroller: RefObject<HTMLDivElement | null>;
  content: RefObject<HTMLDivElement | null>;
  atLatest: boolean;
  toLatest: () => void;
} {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [atLatest, setAtLatest] = useState(true);

  // Watches the transcript's size and the reader's scroll, DOM state outside React.
  useEffect(() => {
    const box = scroller.current;
    const inner = content.current;
    if (!box || !inner || typeof ResizeObserver === 'undefined') return;
    let lastTop = box.scrollTop;
    let sent = inner.querySelectorAll(SENT_MESSAGE).length;
    const near = () => box.scrollHeight - box.scrollTop - box.clientHeight < NEAR_BOTTOM_PX;
    // Only the reader moving up unpins: by the time the scroll this hook
    // made is reported, a streaming reply may have grown past the margin.
    const onScroll = () => {
      if (box.scrollTop < lastTop) pinned.current = near();
      else if (near()) pinned.current = true;
      lastTop = box.scrollTop;
      setAtLatest(pinned.current || near());
    };
    const observer = new ResizeObserver(() => {
      const count = inner.querySelectorAll(SENT_MESSAGE).length;
      if (count > sent) pinned.current = true;
      sent = count;
      if (pinned.current) box.scrollTop = box.scrollHeight;
      setAtLatest(pinned.current || near());
    });
    box.addEventListener('scroll', onScroll, { passive: true });
    observer.observe(inner);
    box.scrollTop = box.scrollHeight;
    return () => {
      box.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, []);

  const toLatest = () => {
    const box = scroller.current;
    if (!box) return;
    pinned.current = true;
    setAtLatest(true);
    const instant = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    box.scrollTo({ top: box.scrollHeight, behavior: instant ? 'auto' : 'smooth' });
  };

  return { scroller, content, atLatest, toLatest };
}
