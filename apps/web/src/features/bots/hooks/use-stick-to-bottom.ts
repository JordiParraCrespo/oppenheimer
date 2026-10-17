import { type RefObject, useEffect, useRef, useState } from 'react';

/** How close to the bottom counts as reading the latest, in pixels. */
const NEAR_BOTTOM_PX = 80;

/** How long a message you just sent takes to glide up to the top of the pane. */
const SLIDE_MS = 320;

/** A message you sent, carrying its id: a new newest one means you are waiting on the answer. */
const SENT_MESSAGE = '[data-slot="chat-user-message"][data-message-id]';

/**
 * The id of the newest message you sent that `root` shows. An id, not a
 * count: once the conversation fills the API's window, a new message evicts
 * the oldest and the count stays the same.
 */
function newestSent(root: HTMLElement): HTMLElement | undefined {
  const all = root.querySelectorAll<HTMLElement>(SENT_MESSAGE);
  return all[all.length - 1];
}

/**
 * Where the gliding message sits, from the pane's top, this far into its
 * slide: a cubic ease-out, quick to leave and soft to land, that lands
 * exactly on `to` at `SLIDE_MS` (Synara's `anchorSlideOffsetPx`).
 */
function slideOffset(from: number, to: number, elapsed: number): number {
  if (elapsed >= SLIDE_MS) return to;
  const progress = Math.max(0, elapsed) / SLIDE_MS;
  return from + (to - from) * (1 - (1 - progress) ** 3);
}

function padding(box: HTMLElement): { top: number; bottom: number } {
  const style = getComputedStyle(box);
  return {
    top: Number.parseFloat(style.paddingTop) || 0,
    bottom: Number.parseFloat(style.paddingBottom) || 0,
  };
}

/**
 * Keeps a scrolling chat on its latest line while the reader is there, the
 * way Synara's transcript does. Sending a message glides it up to the top of
 * the pane, and the answer grows beneath it: `spacer` reserves the room
 * below that lets the message sit there, and shrinks as the answer fills
 * it, so once the answer outgrows the pane the chat follows its tail. The
 * room stays after the turn ends (taking it away would yank the settled
 * chat) until the next send replaces it.
 *
 * Otherwise, when what is inside `content` grows (a message lands, a reply
 * streams) and the reader was at the bottom, `scroller` follows it down.
 * Someone scrolled up to read stays where they are, and `atLatest` turns
 * false so the chat can offer the way back (`toLatest`, a smooth scroll that
 * pins again). A send is known by the newest sent message's id changing
 * (each `ChatUserMessage` carries `data-message-id`); the messages a first
 * load brings, after the skeleton, are not one, and the chat opens at the
 * bottom.
 */
export function useStickToBottom(): {
  scroller: RefObject<HTMLDivElement | null>;
  content: RefObject<HTMLDivElement | null>;
  spacer: RefObject<HTMLDivElement | null>;
  atLatest: boolean;
  toLatest: () => void;
} {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [atLatest, setAtLatest] = useState(true);

  // Watches the transcript's size and the reader's scroll, DOM state outside React.
  useEffect(() => {
    const box = scroller.current;
    const inner = content.current;
    const room = spacer.current;
    if (!box || !inner || !room || typeof ResizeObserver === 'undefined') return;
    let lastTop = box.scrollTop;
    let sent = newestSent(inner)?.dataset.messageId;
    let loading = inner.querySelector('[data-slot="skeleton"]') !== null;
    /** The message the last send glides to the top, and the room held for it. */
    let anchor: string | undefined;
    let frame: number | undefined;
    const near = () => box.scrollHeight - box.scrollTop - box.clientHeight < NEAR_BOTTOM_PX;
    const anchorElement = () =>
      anchor === undefined
        ? null
        : inner.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(anchor)}"]`);

    // Room below the anchored message so that the bottom of the chat is where
    // it sits at the top, one top padding down.
    const reserve = () => {
      const element = anchorElement();
      let height = 0;
      if (element) {
        const pad = padding(box);
        const below = inner.getBoundingClientRect().bottom - element.getBoundingClientRect().top;
        height = Math.max(0, box.clientHeight - pad.top - pad.bottom - below);
      }
      room.style.height = `${height}px`;
    };

    const stopSlide = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
    };

    // One frame loop that re-reads where the message is each frame, so the
    // glide stays on schedule while the room and the answer change under it.
    const slide = () => {
      stopSlide();
      const element = anchorElement();
      const instant = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (!element || instant || typeof requestAnimationFrame === 'undefined') {
        box.scrollTop = box.scrollHeight;
        return;
      }
      const rest = padding(box).top;
      const offset = () => element.getBoundingClientRect().top - box.getBoundingClientRect().top;
      const from = Math.min(Math.max(offset(), rest), box.clientHeight);
      const start = performance.now();
      const step = () => {
        const elapsed = performance.now() - start;
        if (elapsed >= SLIDE_MS) {
          frame = undefined;
          box.scrollTop = box.scrollHeight;
          return;
        }
        const max = box.scrollHeight - box.clientHeight;
        const target = box.scrollTop + offset() - slideOffset(from, rest, elapsed);
        box.scrollTop = Math.min(max, Math.max(0, target));
        frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    // Only the reader moving up unpins: by the time the scroll this hook
    // made is reported, a streaming reply may have grown past the margin.
    const onScroll = () => {
      if (box.scrollTop < lastTop) pinned.current = near();
      else if (near()) pinned.current = true;
      lastTop = box.scrollTop;
      setAtLatest(pinned.current || near());
    };
    // The reader taking hold of the scroll ends a glide where it is.
    const onGesture = () => stopSlide();

    const sync = () => {
      const newest = newestSent(inner)?.dataset.messageId;
      const sending = newest !== sent && newest !== undefined && !loading;
      if (newest !== sent && newest !== undefined) pinned.current = true;
      if (sending) anchor = newest;
      sent = newest;
      loading = inner.querySelector('[data-slot="skeleton"]') !== null;
      reserve();
      // While a glide runs, its frame loop owns the scroll.
      if (sending) slide();
      else if (pinned.current && frame === undefined) box.scrollTop = box.scrollHeight;
      setAtLatest(pinned.current || near());
    };

    const observer = new ResizeObserver(sync);
    box.addEventListener('scroll', onScroll, { passive: true });
    for (const name of ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const) {
      box.addEventListener(name, onGesture, { passive: true });
    }
    observer.observe(inner);
    observer.observe(box);
    box.scrollTop = box.scrollHeight;
    return () => {
      stopSlide();
      box.removeEventListener('scroll', onScroll);
      for (const name of ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const) {
        box.removeEventListener(name, onGesture);
      }
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

  return { scroller, content, spacer, atLatest, toLatest };
}
