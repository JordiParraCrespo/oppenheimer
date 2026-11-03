import { type RefObject, useEffect, useRef, useState } from 'react';

/** How close to the bottom counts as reading the latest, in pixels. */
const NEAR_BOTTOM_PX = 80;
/**
 * How long after the reader's own input (a wheel, a touch, a key) a move up
 * is theirs. Chromium's smooth wheel scroll and a trackpad's glide run on
 * after the last event, for a few hundred milliseconds; this is chosen
 * well past that, not measured. Too short, and the tail of a glide snaps
 * back to the end; too long only means a clamp just after the reader's own
 * scroll down can still let go, which that scroll had nearly done anyway.
 */
const READER_INPUT_MS = 1000;
/** The keys that scroll a pane up. */
const UP_KEYS = new Set(['ArrowUp', 'PageUp', 'Home']);

/**
 * Whether the scroller's latest move is the reader's: a wheel turned up, a
 * touch, an up key or a press on its scrollbar, just now or still held.
 * The browser moves the view on its own too (a clamp when the content
 * shrinks), and only this tells the two apart. `stop` removes its listeners.
 */
function readerInput(box: HTMLElement): { reading: () => boolean; stop: () => void } {
  let at = Number.NEGATIVE_INFINITY;
  let dragging = false;
  const mark = () => {
    at = performance.now();
  };
  const onWheel = (event: WheelEvent) => {
    if (event.deltaY < 0) mark();
  };
  const onKey = (event: KeyboardEvent) => {
    if (UP_KEYS.has(event.key) || (event.key === ' ' && event.shiftKey)) mark();
  };
  // The scrollbar is the scroller's own: a press on it, not on what it holds.
  const onPress = (event: PointerEvent) => {
    if (event.target !== box) return;
    dragging = true;
    mark();
  };
  const onRelease = () => {
    if (dragging) mark();
    dragging = false;
  };
  box.addEventListener('wheel', onWheel, { passive: true });
  box.addEventListener('touchmove', mark, { passive: true });
  box.addEventListener('keydown', onKey);
  box.addEventListener('pointerdown', onPress);
  window.addEventListener('pointerup', onRelease);
  window.addEventListener('pointercancel', onRelease);
  return {
    reading: () => dragging || performance.now() - at < READER_INPUT_MS,
    stop: () => {
      box.removeEventListener('wheel', onWheel);
      box.removeEventListener('touchmove', mark);
      box.removeEventListener('keydown', onKey);
      box.removeEventListener('pointerdown', onPress);
      window.removeEventListener('pointerup', onRelease);
      window.removeEventListener('pointercancel', onRelease);
    },
  };
}

/** Follows the end or stops: scroll anchoring only while it does not. */
function follow(pinned: { current: boolean }, box: HTMLElement, on: boolean): void {
  pinned.current = on;
  box.style.overflowAnchor = on ? 'none' : '';
}

/**
 * Keeps a scrolling chat on its latest line while the reader is there: when
 * what is inside `content` grows (a message lands, a reply streams) or the
 * `scroller` shrinks (the composer grows a line, the window does) and the
 * reader was at the bottom, it follows them down. Someone who scrolled up to
 * read stays where they are, and `atLatest` turns false so the chat can offer
 * the way back (`toLatest`, a smooth scroll that pins again). Only the reader
 * moving up unpins, which is a move up that follows their own input (a wheel,
 * a touch, a key, the scrollbar): a smooth scroll down passes through
 * positions far from the end, a turn may have grown past the margin by the
 * time this hook's own scroll is reported, and the browser moves the view up
 * itself when the content shrinks under it, reported a frame later, when the
 * content may have grown again.
 *
 * `repin` lets a chat pin again on something it can see in the content (a
 * message the reader just sent): it is read once, called when the hook starts
 * watching and on every resize, and a `true` pins. Between `hold(true)` and
 * `hold(false)` something else owns the scroll (an animation of the chat's
 * own) and this hook does not follow. The first layout opens at the bottom.
 *
 * While it follows, the scroller has no scroll anchoring: what leaves the top
 * of a chat that keeps a window of its latest lines would otherwise move the
 * view up by its height, and that move reads as the reader leaving the end.
 * Away from the end, anchoring is back, and keeps the reader's place.
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
    const reader = readerInput(box);
    // Up and the reader's: they leave the end unless still near it. Up and
    // not theirs while following: the browser's, so back to the end. Down
    // to near the end: follow again.
    const onScroll = () => {
      const up = box.scrollTop < lastTop;
      if (up && reader.reading()) follow(pinned, box, near());
      else if (up && pinned.current && !held.current) box.scrollTop = box.scrollHeight;
      else if (!up && near()) follow(pinned, box, true);
      lastTop = box.scrollTop;
      setAtLatest(pinned.current || near());
    };
    const observer = new ResizeObserver(() => {
      if (shouldRepin?.(inner)) follow(pinned, box, true);
      if (pinned.current && !held.current) box.scrollTop = box.scrollHeight;
      setAtLatest(pinned.current || near());
    });
    shouldRepin?.(inner);
    follow(pinned, box, pinned.current);
    box.addEventListener('scroll', onScroll, { passive: true });
    observer.observe(inner);
    observer.observe(box);
    box.scrollTop = box.scrollHeight;
    return () => {
      box.removeEventListener('scroll', onScroll);
      reader.stop();
      observer.disconnect();
    };
  }, []);

  const hold = (owning: boolean) => {
    held.current = owning;
  };

  const toLatest = () => {
    const box = scroller.current;
    if (!box) return;
    follow(pinned, box, true);
    setAtLatest(true);
    const instant = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    box.scrollTo({ top: box.scrollHeight, behavior: instant ? 'auto' : 'smooth' });
  };

  return { scroller, content, hold, atLatest, toLatest };
}
