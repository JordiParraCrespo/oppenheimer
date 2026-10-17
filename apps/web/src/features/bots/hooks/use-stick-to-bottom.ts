import { type RefObject, useEffect, useRef, useState } from 'react';

/** How close to the bottom counts as reading the latest, in pixels. */
const NEAR_BOTTOM_PX = 80;

/** A message you sent, carrying its id: a new newest one means you are waiting on the answer. */
const SENT_MESSAGE = '[data-slot="chat-user-message"][data-message-id]';

/**
 * The id of the newest message you sent that `root` shows. An id, not a
 * count: once the conversation fills the API's window, a new message evicts
 * the oldest and the count stays the same.
 */
function newestSent(root: HTMLElement): string | undefined {
  const all = root.querySelectorAll<HTMLElement>(SENT_MESSAGE);
  return all[all.length - 1]?.dataset.messageId;
}

/**
 * Keeps a scrolling chat on its latest line while the reader is there: when
 * what is inside `content` grows (a message lands, a reply streams) and the
 * reader was at the bottom, `scroller` follows it down. Someone scrolled up
 * to read stays where they are, and `atLatest` turns false so the chat can
 * offer the way back (`toLatest`, a smooth scroll that pins again). Sending a
 * message pins it too, known by the newest sent message's id changing (each
 * `ChatUserMessage` carries `data-message-id`): you want to see the answer
 * to what you just asked.
 * The first layout opens at the bottom. While `held` is set, something
 * else owns the scroll (the glide of a message you sent, `useSentGlide`) and
 * this hook does not follow.
 */
export function useStickToBottom(): {
  scroller: RefObject<HTMLDivElement | null>;
  content: RefObject<HTMLDivElement | null>;
  held: RefObject<boolean>;
  atLatest: boolean;
  toLatest: () => void;
} {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const held = useRef(false);
  const [atLatest, setAtLatest] = useState(true);

  // Watches the transcript's size and the reader's scroll, DOM state outside React.
  useEffect(() => {
    const box = scroller.current;
    const inner = content.current;
    if (!box || !inner || typeof ResizeObserver === 'undefined') return;
    let lastTop = box.scrollTop;
    let sent = newestSent(inner);
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
      const newest = newestSent(inner);
      if (newest !== sent) pinned.current = true;
      sent = newest;
      if (pinned.current && !held.current) box.scrollTop = box.scrollHeight;
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

  return { scroller, content, held, atLatest, toLatest };
}
