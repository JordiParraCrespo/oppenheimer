import type { ChatFindHit } from '@oppenheimer/frontend-consumer';
import { type RefObject, useEffect, useLayoutEffect } from 'react';

/** The names the console's stylesheet paints (`::highlight(...)`, `globals.css`). */
const ALL = 'chat-find';
const CURRENT = 'chat-find-current';

/** Where the match the find lands on sits in the chat's view, from its top: a third of the way down. */
const LANDING = 1 / 3;

/** Whether this browser paints ranges without touching the DOM (the CSS Custom Highlight API). */
function canHighlight(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
}

/**
 * Every match of `needle` in the words of one element, as ranges: its text
 * nodes read as one string, so a match across a bold word or a link is found.
 */
function rangesIn(element: Element, needle: string): Range[] {
  const nodes: { node: Text; start: number }[] = [];
  let text = '';
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = (node as Text).data;
    nodes.push({ node: node as Text, start: text.length });
    text += value;
  }
  const at = (offset: number, end: boolean) => {
    // The last node starting before the offset, or at it for a range's start.
    let found = nodes[0];
    for (const entry of nodes) {
      if (end ? entry.start < offset : entry.start <= offset) found = entry;
      else break;
    }
    return { node: found.node, offset: offset - found.start };
  };
  const ranges: Range[] = [];
  const lower = text.toLocaleLowerCase();
  for (
    let from = lower.indexOf(needle);
    from >= 0;
    from = lower.indexOf(needle, from + needle.length)
  ) {
    const start = at(from, false);
    const end = at(from + needle.length, true);
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    ranges.push(range);
  }
  return ranges;
}

/** Each drawn turn's matches, by its id, in reading order. */
function matchesIn(box: HTMLElement, needle: string): Map<string, Range[]> {
  const byTurn = new Map<string, Range[]>();
  for (const words of box.querySelectorAll('[data-chat-find]')) {
    const turn = words.closest<HTMLElement>('[data-turn]')?.dataset.turn;
    if (!turn) continue;
    const ranges = rangesIn(words, needle);
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

function paint(box: HTMLElement, needle: string, hit: ChatFindHit | null): Range | null {
  const byTurn = matchesIn(box, needle);
  const current = currentOf(byTurn, hit);
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
 * moving the reader. A browser without the CSS Custom Highlight API paints
 * nothing and still scrolls.
 *
 * Effects: the browser's highlight registry, the scroller's position, and a
 * `MutationObserver` on the chat's content.
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
    const current = canHighlight()
      ? paint(box, needle, hit)
      : currentOf(matchesIn(box, needle), hit);
    if (!current) return;
    const top = current.getBoundingClientRect().top - box.getBoundingClientRect().top;
    box.scrollBy({ top: top - box.clientHeight * LANDING });
  }, [scroller, needle, hit]);

  useEffect(() => {
    const box = scroller.current;
    if (!box || !needle || !canHighlight()) return;
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
