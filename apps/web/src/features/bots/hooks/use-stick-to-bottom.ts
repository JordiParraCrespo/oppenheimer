import { type RefObject, useEffect, useRef } from 'react';

/** How close to the bottom counts as reading the latest, in pixels. */
const NEAR_BOTTOM_PX = 80;

/**
 * Keeps a scrolling chat on its latest line while the reader is there: when
 * what is inside `content` grows (a message lands, a reply streams) and the
 * reader was at the bottom, `scroller` follows it down. Someone scrolled up
 * to read stays where they are. The first layout opens at the bottom.
 */
export function useStickToBottom(): {
  scroller: RefObject<HTMLDivElement | null>;
  content: RefObject<HTMLDivElement | null>;
} {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  // Watches the transcript's size, a DOM measurement outside React.
  useEffect(() => {
    const box = scroller.current;
    const inner = content.current;
    if (!box || !inner || typeof ResizeObserver === 'undefined') return;
    let pinned = true;
    let lastTop = box.scrollTop;
    // Only the reader moving up unpins: by the time the scroll this hook
    // made is reported, a streaming reply may have grown past the margin.
    const onScroll = () => {
      const near = box.scrollHeight - box.scrollTop - box.clientHeight < NEAR_BOTTOM_PX;
      if (box.scrollTop < lastTop) pinned = near;
      else if (near) pinned = true;
      lastTop = box.scrollTop;
    };
    const observer = new ResizeObserver(() => {
      if (pinned) box.scrollTop = box.scrollHeight;
    });
    box.addEventListener('scroll', onScroll, { passive: true });
    observer.observe(inner);
    box.scrollTop = box.scrollHeight;
    return () => {
      box.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, []);

  return { scroller, content };
}
