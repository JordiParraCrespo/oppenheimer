/**
 * The cards the reader picked on the board to act on together, the way a file
 * list picks: a click with ⌘ or Ctrl (or any click once something is picked)
 * toggles one card, a click with Shift takes every card between the last one
 * toggled and this one, in the board's reading order (column by column, top
 * to bottom). The selection is the reader's, for this page; the API never
 * hears of it.
 */
export type CardSelection = {
  ids: readonly string[];
  /** The card a Shift-click extends from: the last one toggled. */
  anchor: string | null;
};

export const NO_CARD_SELECTION: CardSelection = { ids: [], anchor: null };

/** How a click picks: one card, or the cards from the anchor to it. */
export type CardPick = 'toggle' | 'range';

/**
 * The selection after a click on `id`. `order` is the cards as the board draws
 * them; a range needs both ends in it, and is a toggle otherwise. A range adds
 * to what is picked and keeps its anchor.
 */
export function pickCard(
  selection: CardSelection,
  id: string,
  how: CardPick,
  order: readonly string[],
): CardSelection {
  const from = selection.anchor === null ? -1 : order.indexOf(selection.anchor);
  const to = order.indexOf(id);
  if (how === 'range' && from !== -1 && to !== -1) {
    const span = order.slice(Math.min(from, to), Math.max(from, to) + 1);
    return { ids: [...new Set([...selection.ids, ...span])], anchor: selection.anchor };
  }
  const ids = selection.ids.includes(id)
    ? selection.ids.filter((picked) => picked !== id)
    : [...selection.ids, id];
  return ids.length === 0 ? NO_CARD_SELECTION : { ids, anchor: id };
}

/**
 * How a click on a card reads: a pick, or `null` to open the task. Shift and
 * ⌘/Ctrl always pick; a plain click picks only while something already is.
 */
export function cardClickPick(
  event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
  selecting: boolean,
): CardPick | null {
  if (event.shiftKey) return 'range';
  if (event.metaKey || event.ctrlKey || selecting) return 'toggle';
  return null;
}

/**
 * The elements on the board that take their own press: a card's check,
 * Start and session chip, the column's add row, the composer. A click there
 * neither opens nor picks the card, and a press there draws no marquee.
 */
export const OWNS_PRESS =
  'button, a, input, textarea, select, [role="checkbox"], [contenteditable]';

/** A rectangle in viewport pixels, as `getBoundingClientRect` reads one. */
export type Box = { left: number; top: number; width: number; height: number };

/** How far the pointer travels from the press before a drag draws the marquee. */
export const MARQUEE_THRESHOLD = 4;

/** The rectangle between the press and where the pointer is now, either way round. */
export function marqueeBox(from: { x: number; y: number }, to: { x: number; y: number }): Box {
  return {
    left: Math.min(from.x, to.x),
    top: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y),
  };
}

function overlap(a: Box, b: Box): Box | null {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const width = Math.min(a.left + a.width, b.left + b.width) - left;
  const height = Math.min(a.top + a.height, b.top + b.height) - top;
  return width > 0 && height > 0 ? { left, top, width, height } : null;
}

/**
 * The ids the marquee picks: `kept` (what was picked before an additive,
 * ⌘/Ctrl/Shift drag; empty otherwise) and every card the box touches, in
 * that order, each once. Touching is enough, as in a file manager. `visible`
 * is the board scroller's box: a card scrolled out of it cannot be touched.
 */
export function marqueePick(
  box: Box,
  cards: readonly { id: string; box: Box }[],
  kept: readonly string[],
  visible: Box,
): string[] {
  const touched = cards
    .filter(({ box: card }) => {
      const shown = overlap(card, visible);
      return shown !== null && overlap(shown, box) !== null;
    })
    .map(({ id }) => id);
  return [...new Set([...kept, ...touched])];
}
