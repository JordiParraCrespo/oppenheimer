/**
 * The sessions the reader picked in the sidebar to act on together, the way a
 * file list picks: a click with ⌘ or Ctrl (or any click once something is
 * picked) toggles one row, a click with Shift takes every row between the
 * last one toggled and this one. The selection is the reader's, for this
 * page, and the API never hears of it; what it acts on is each session's own
 * write.
 */
export type SessionSelection = {
  ids: readonly string[];
  /** The row a Shift-click extends from: the last one toggled. */
  anchor: string | null;
};

export const NO_SELECTION: SessionSelection = { ids: [], anchor: null };

/** How a click picks: one row, or the rows from the anchor to it. */
export type SelectionPick = 'toggle' | 'range';

/**
 * The selection after a click on `id`. `order` is the rows as the sidebar
 * draws them, top to bottom; a range needs both ends in it, and is a toggle
 * otherwise. A range adds to what is picked and never takes away, and keeps
 * its anchor, so a second Shift-click redraws from the same row.
 */
export function pickSession(
  selection: SessionSelection,
  id: string,
  how: SelectionPick,
  order: readonly string[],
): SessionSelection {
  const from = selection.anchor === null ? -1 : order.indexOf(selection.anchor);
  const to = order.indexOf(id);
  if (how === 'range' && from !== -1 && to !== -1) {
    const span = order.slice(Math.min(from, to), Math.max(from, to) + 1);
    return { ids: [...new Set([...selection.ids, ...span])], anchor: selection.anchor };
  }
  const ids = selection.ids.includes(id)
    ? selection.ids.filter((picked) => picked !== id)
    : [...selection.ids, id];
  return ids.length === 0 ? NO_SELECTION : { ids, anchor: id };
}

/**
 * How a click on a row reads: a pick, or `null` to open the session. Shift
 * and ⌘/Ctrl always pick; a plain click picks only while something already
 * is, so the list stays in selection until it is cleared.
 */
export function clickPick(
  event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
  selecting: boolean,
): SelectionPick | null {
  if (event.shiftKey) return 'range';
  if (event.metaKey || event.ctrlKey || selecting) return 'toggle';
  return null;
}

/**
 * A bulk action over the picked rows: `act` runs on each of them side by
 * side, and what comes back is the rows it failed on, which stay picked to
 * try again, and the first reason, which the caller shows. One policy for
 * every bulk write, so a partial failure reads the same wherever it happens.
 */
export async function settleEach<T>(
  items: readonly T[],
  act: (item: T) => Promise<unknown>,
): Promise<{ failed: T[]; reason: unknown }> {
  const results = await Promise.allSettled(items.map(act));
  const failed = items.filter((_, index) => results[index]?.status === 'rejected');
  const first = results.find((result) => result.status === 'rejected');
  return { failed, reason: first ? first.reason : null };
}
