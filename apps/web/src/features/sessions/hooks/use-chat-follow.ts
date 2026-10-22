import { type RefObject, useEffect, useRef, useState } from 'react';

/** How close to the end still counts as reading the latest. */
const NEAR_END_PX = 96;

/**
 * Keeps the chat view on its newest turn while the reader is there, and lets
 * them scroll back without being pulled down by the next entry; `away` says
 * when they have left, for the chip that brings them back. Synchronises with
 * the scroller's DOM: its scroll position and its content's size.
 */
export function useChatFollow(): {
  scrollerRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  away: boolean;
  toLatest: () => void;
} {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const followingRef = useRef(true);
  const [away, setAway] = useState(false);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    let lastTop = scroller.scrollTop;
    const near = () =>
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < NEAR_END_PX;
    const toEnd = () => {
      if (followingRef.current) scroller.scrollTop = scroller.scrollHeight;
      setAway(!followingRef.current && !near());
    };
    // Only the reader moving up leaves the latest: a smooth scroll down to it
    // passes through positions far from the end, and a turn may have grown
    // past the margin by the time this hook's own scroll is reported.
    const onScroll = () => {
      if (scroller.scrollTop < lastTop) followingRef.current = near();
      else if (near()) followingRef.current = true;
      lastTop = scroller.scrollTop;
      setAway(!followingRef.current && !near());
    };
    // The content grows with each turn; the scroller shrinks when the
    // composer grows a line or the window does.
    const resize = new ResizeObserver(toEnd);
    resize.observe(content);
    resize.observe(scroller);
    scroller.addEventListener('scroll', onScroll, { passive: true });
    toEnd();
    return () => {
      resize.disconnect();
      scroller.removeEventListener('scroll', onScroll);
    };
  }, []);

  const toLatest = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    followingRef.current = true;
    setAway(false);
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
  };

  return { scrollerRef, contentRef, away, toLatest };
}
