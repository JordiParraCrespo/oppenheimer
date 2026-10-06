import { useMatches } from '@tanstack/react-router';
import { type RefObject, useEffect, useRef } from 'react';

/**
 * A ref for a scroller that one frame keeps across pages, and the effect that
 * brings it back to the top when the page changes: the leaf route (a search
 * param over the same page, `?task=` over the board, keeps its place) or the
 * measure it is drawn at (a pull request's briefing and its description).
 *
 * The scroller stays mounted. Remounting it to reset the scroll would take
 * the page's state, focus and transitions with it.
 */
export function useScrollReset<T extends HTMLElement>(measure: string): RefObject<T | null> {
  const scroller = useRef<T>(null);
  const page = useMatches({ select: (matches) => matches.at(-1)?.routeId });
  // Synchronises the DOM's scroll position with the page shown.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the page and the measure are what the reset answers to, not what it reads.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [page, measure]);
  return scroller;
}
