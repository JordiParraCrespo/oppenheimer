import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import {
  NO_SELECTION,
  pickSession,
  type SelectionPick,
  type SessionSelection,
} from '../lib/session-selection';

export type SessionSelectionStore = {
  subscribe: (listener: () => void) => () => void;
  ids: () => readonly string[];
  pick: (id: string, how: SelectionPick) => void;
  /** The rows as drawn, top to bottom: what a Shift-click spans. */
  setOrder: (order: readonly string[]) => void;
  /**
   * Leaves exactly `ids` picked: what a bulk write left to try again. The
   * anchor goes with the rest, so the next Shift-click spans from a row the
   * reader toggles, never one the write took away.
   */
  keep: (ids: readonly string[]) => void;
  clear: () => void;
};

function createSelectionStore(): SessionSelectionStore {
  let selection: SessionSelection = NO_SELECTION;
  let order: readonly string[] = [];
  const listeners = new Set<() => void>();
  const set = (next: SessionSelection) => {
    if (next === selection) return;
    selection = next;
    for (const listener of listeners) listener();
  };
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    ids: () => selection.ids,
    pick: (id, how) => set(pickSession(selection, id, how, order)),
    setOrder: (next) => {
      order = next;
    },
    keep: (ids) => set(ids.length === 0 ? NO_SELECTION : { ids: [...ids], anchor: null }),
    clear: () => set(NO_SELECTION),
  };
}

/**
 * The sidebar's selection, as a store behind a context whose value never
 * changes: each row subscribes to whether it is picked, so a click redraws
 * the row it picked and not its hundred neighbours (only entering or leaving
 * selection redraws them all, since every row's glyph turns into a box).
 */
export const SessionSelectionContext = createContext<SessionSelectionStore | null>(null);

/**
 * The store, for the sidebar that owns it. `order` is the rows as drawn, top
 * to bottom, which a Shift-click spans; it is read when a click lands, so a
 * new order never redraws a row.
 */
export function useSessionSelectionStore(order: readonly string[]): SessionSelectionStore {
  const [store] = useState(createSelectionStore);
  // The store outside React learns the order React last drew; no row reads it until a click.
  useEffect(() => store.setOrder(order));

  // A window key listener: Escape leaves selection, unless something
  // opened over the list (a menu, a dialog) took the key first.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && store.ids().length > 0) {
        store.clear();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);

  return store;
}

function useStore(): SessionSelectionStore {
  const store = useContext(SessionSelectionContext);
  if (!store) throw new Error('A session row needs the sidebar’s SessionSelectionContext.');
  return store;
}

/** The ids picked, for what acts on them. */
export function useSelectedSessionIds(): readonly string[] {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.ids);
}

/** Whether anything is picked: what turns the list into selection. */
export function useSelecting(store: SessionSelectionStore): boolean {
  return useSyncExternalStore(store.subscribe, () => store.ids().length > 0);
}

/** One row's end: whether the list is selecting, whether this row is picked, and the pick. */
export function useSessionSelected(id: string) {
  const store = useStore();
  const selecting = useSelecting(store);
  const selected = useSyncExternalStore(store.subscribe, () => store.ids().includes(id));
  return {
    selecting,
    selected,
    pick: (how: SelectionPick) => store.pick(id, how),
  };
}

/** The store's actions, for the bar and the dialogs: they never redraw on a pick. */
export function useSessionSelectionActions() {
  const store = useStore();
  return { keep: store.keep, clear: store.clear };
}
