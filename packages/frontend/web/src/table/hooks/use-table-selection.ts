import { useState } from 'react';

/** One frozen empty set, so an untouched selection has a stable identity. */
const NO_SELECTION: ReadonlySet<string> = new Set();

export interface TableSelection {
  selected: ReadonlySet<string>;
  /** The ticked keys that are on the page in front of the reader, and only those. */
  selectedOnPage: string[];
  allSelected: boolean;
  someSelected: boolean;
  toggleAll: () => void;
  toggleOne: (key: string) => void;
  clearSelection: () => void;
}

/**
 * Which rows are ticked, and the rule that drops them when the query moves.
 *
 * The rows on screen are one page of a server-side query, so a key ticked under
 * a different page, search or filter is no longer something the reader can see
 * — and a bulk action carrying it would change a record they were never shown.
 * Two things keep that from happening: the selection is stored together with
 * the query it was made under and reads as empty under any other, and what the
 * bulk callbacks receive is intersected with the current page regardless.
 *
 * Storing the identity beside the keys is what makes "drop it when the query
 * moves" a derivation rather than an effect: there is no moment where the old
 * selection renders against the new rows. The reset below then commits the
 * drop, so coming back to the same page later does not resurrect ticks the
 * reader stopped seeing when they left.
 *
 * A hook rather than a block inside `DataTable`, because it is one of the three
 * things that component used to hold on three different clocks. It is still
 * shell state: a tick re-renders the table, rows included. Isolating that would
 * mean moving the set out of React's render path entirely — a store each row
 * subscribes to by its own key — which is a change to how a selection behaves,
 * not a rename, and it is not this one. `DataTableRow` being its own file does
 * not isolate a tick, and nothing here claims it does.
 */
export function useTableSelection({
  queryIdentity,
  pageKeys,
}: {
  /** What the rows are a page *of*. A change to it empties the selection. */
  queryIdentity: string;
  pageKeys: string[];
}): TableSelection {
  const [selection, setSelection] = useState<{
    identity: string;
    keys: ReadonlySet<string>;
  }>(() => ({ identity: queryIdentity, keys: NO_SELECTION }));

  if (selection.identity !== queryIdentity) {
    setSelection({ identity: queryIdentity, keys: NO_SELECTION });
  }
  const selected = selection.identity === queryIdentity ? selection.keys : NO_SELECTION;

  /** Applies `update` to the selection made under the current query. */
  const updateSelection = (update: (current: ReadonlySet<string>) => ReadonlySet<string>) =>
    setSelection((current) => ({
      identity: queryIdentity,
      keys: update(current.identity === queryIdentity ? current.keys : NO_SELECTION),
    }));

  const allSelected = pageKeys.length > 0 && pageKeys.every((key) => selected.has(key));

  return {
    selected,
    selectedOnPage: pageKeys.filter((key) => selected.has(key)),
    allSelected,
    someSelected: !allSelected && pageKeys.some((key) => selected.has(key)),
    clearSelection: () => updateSelection(() => NO_SELECTION),
    toggleAll: () =>
      updateSelection((current) => {
        const next = new Set(current);
        for (const key of pageKeys) {
          if (allSelected) next.delete(key);
          else next.add(key);
        }
        return next;
      }),
    toggleOne: (key: string) =>
      updateSelection((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }),
  };
}
