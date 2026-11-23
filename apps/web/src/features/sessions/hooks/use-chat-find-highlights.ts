import { type RefObject, useLayoutEffect } from 'react';
import { type ChatFindHit, findRangesIn } from '../lib/chat-find';

/** The names the console's stylesheet paints (`::highlight(...)`, `globals.css`). */
const ALL = 'chat-find';
const CURRENT = 'chat-find-current';

/** Where the match the find lands on sits in the chat's view, from its top: a third of the way down. */
const LANDING = 1 / 3;

/** Whether this browser paints ranges without touching the DOM (the CSS Custom Highlight API). */
function canHighlight(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
}

/** Each drawn turn's matches, by its id, in reading order. */
function matchesIn(box: HTMLElement, needle: string): Map<string, Range[]> {
  const byTurn = new Map<string, Range[]>();
  for (const words of box.querySelectorAll('[data-chat-find]')) {
    const turn = words.closest<HTMLElement>('[data-turn]')?.dataset.turn;
    if (!turn) continue;
    const ranges = findRangesIn(words, needle);
    if (ranges.length === 0) continue;
    byTurn.set(turn, [...(byTurn.get(turn) ?? []), ...ranges]);
  }
  return byTurn;
}

/** The range a hit stands for: its turn's match by index, or that turn's last when the words drew fewer. */
function currentOf(byTurn: Map<string, Range[]>, hit: ChatFindHit | null): Range | null {
  if (!hit) return null;
  const ranges = byTurn.get(hit.turnId);
  if (!ranges || ranges.length === 0) return null;
  return ranges[Math.min(hit.index, ranges.length - 1)];
}

/** Paints the matches, and returns the one the find is on. */
function paint(box: HTMLElement, needle: string, hit: ChatFindHit | null): Range | null {
  const byTurn = matchesIn(box, needle);
  const current = currentOf(byTurn, hit);
  if (!canHighlight()) return current;
  const all = [...byTurn.values()].flat().filter((range) => range !== current);
  CSS.highlights.set(ALL, new Highlight(...all));
  if (current) CSS.highlights.set(CURRENT, new Highlight(current));
  else CSS.highlights.delete(CURRENT);
  return current;
}

/**
 * Paints the find's matches in the session chat's words and brings the one
 * it is on into view: `query`'s matches in every drawn prompt and reply
 * (the elements marked `data-chat-find`, inside one marked `data-turn`),
 * `hit` set apart. A new `hit` scrolls the chat to it, a third of the way
 * down; the words changing under the find (a reply streaming in, a code
 * block's colours landing) paints again where the matches now are, without
 * moving the reader. The match it lands on in a reply's closed `<details>`
 * opens it. A browser without the CSS Custom Highlight API paints nothing
 * and still scrolls.
 *
 * Effect: the browser's highlight registry, the scroller's position, and a
 * `MutationObserver` on the chat's content. One layout effect does all
 * three, so the registry a step cleans up is the one the step before it
 * painted, never the one it paints itself.
 */
export function useChatFindHighlights(
  scroller: RefObject<HTMLElement | null>,
  query: string | null,
  hit: ChatFindHit | null,
): void {
  const needle = query?.trim().toLocaleLowerCase() ?? '';

  // Layout: the turn a hit opened or drew is in the DOM by now, and the
  // scroll lands before the frame is painted.
  useLayoutEffect(() => {
    const box = scroller.current;
    if (!box || !needle) return;
    const current = paint(box, needle, hit);
    if (current) {
      // A match in a reply's closed fold opens it, so the words are drawn.
      for (let at = current.startContainer.parentElement; at && at !== box; at = at.parentElement) {
        if (at instanceof HTMLDetailsElement) at.open = true;
      }
      const top = current.getBoundingClientRect().top - box.getBoundingClientRect().top;
      box.scrollBy({ top: top - box.clientHeight * LANDING });
    }
    if (!canHighlight()) return;
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => paint(box, needle, hit));
    });
    observer.observe(box, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      CSS.highlights.delete(ALL);
      CSS.highlights.delete(CURRENT);
    };
  }, [scroller, needle, hit]);
}
