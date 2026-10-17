import {
  createContext,
  type RefObject,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';

/**
 * The chat's scrolling pane, for what inside it moves the scroll: the pane,
 * the room after the transcript, and `held`, set while something other than
 * following the latest owns the scroll. Every field is a ref, so the value
 * never changes and nothing re-renders through it.
 */
export const ChatScroll = createContext<{
  scroller: RefObject<HTMLDivElement | null>;
  room: RefObject<HTMLDivElement | null>;
  held: RefObject<boolean>;
} | null>(null);

/** How long a message you just sent takes to glide up to the top of the pane. */
const SLIDE_MS = 320;

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
 * The way Synara's transcript scrolls after a send: the message you sent
 * glides up to the top of the pane and the answer grows beneath it. `sentId`
 * is the newest message you sent; the one the chat opens with is where it
 * already is, and each new one glides.
 *
 * The pane's `room`, after the transcript, holds the space below that lets
 * the message sit at the top: sized so the bottom of the chat is where it
 * rests, one top padding down, and shrinking as the answer fills it, so once
 * the answer outgrows the pane following the latest carries on as before.
 * The room stays after the turn ends (taking it away would yank the settled
 * chat) until the next send replaces it.
 *
 * The glide owns the scroll while it runs (`held`), and lets go the moment
 * the scroll is not where it left it: the reader took hold.
 */
export function useSentGlide(sentId: string | undefined): void {
  const pane = useContext(ChatScroll);
  const opened = useRef(sentId);
  const anchor = useRef<HTMLElement | null>(null);

  // Sizes the room to the pane and the transcript as they change, DOM state outside React.
  useEffect(() => {
    const box = pane?.scroller.current;
    const room = pane?.room.current;
    const transcript = room?.previousElementSibling;
    if (!box || !room || !transcript || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => reserve(box, room, anchor.current));
    observer.observe(box);
    observer.observe(transcript);
    return () => observer.disconnect();
  }, [pane]);

  // Glides each new send to the top, a frame loop over the pane's scroll; a
  // layout effect, so it holds the scroll before the pane follows the growth.
  useLayoutEffect(() => {
    const box = pane?.scroller.current;
    const room = pane?.room.current;
    if (!pane || !box || !room || sentId === undefined || sentId === opened.current) return;
    opened.current = sentId;
    const element = box.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(sentId)}"]`);
    anchor.current = element;
    reserve(box, room, element);
    const instant = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!element || instant || typeof requestAnimationFrame === 'undefined') {
      box.scrollTop = box.scrollHeight;
      return;
    }

    const rest = padding(box).top;
    const offset = () => element.getBoundingClientRect().top - box.getBoundingClientRect().top;
    const from = Math.min(Math.max(offset(), rest), box.clientHeight);
    const start = performance.now();
    let left = box.scrollTop;
    let frame: number | undefined;
    pane.held.current = true;
    const step = () => {
      frame = undefined;
      if (Math.abs(box.scrollTop - left) > 1) {
        pane.held.current = false;
        return;
      }
      const elapsed = performance.now() - start;
      if (elapsed >= SLIDE_MS) {
        pane.held.current = false;
        box.scrollTop = box.scrollHeight;
        return;
      }
      const max = box.scrollHeight - box.clientHeight;
      const target = box.scrollTop + offset() - slideOffset(from, rest, elapsed);
      box.scrollTop = Math.min(max, Math.max(0, target));
      left = box.scrollTop;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      pane.held.current = false;
    };
  }, [pane, sentId]);
}

/** Room below `anchor` so that the bottom of the chat is where it sits at the top. */
function reserve(box: HTMLElement, room: HTMLElement, anchor: HTMLElement | null): void {
  let height = 0;
  if (anchor?.isConnected) {
    const pad = padding(box);
    const below = room.getBoundingClientRect().top - anchor.getBoundingClientRect().top;
    height = Math.max(0, box.clientHeight - pad.top - pad.bottom - below);
  }
  room.style.height = `${height}px`;
}
