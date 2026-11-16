import { useState } from 'react';
import {
  closeTab,
  type KeptSideItem,
  type KeptSidePane,
  openKept,
  rememberSidePane,
  sideItemKey,
  storedSidePane,
} from '../lib/side-pane';

/**
 * What this device keeps open in one session's side pane, and which tab
 * shows. Read once per session: the session route is keyed by its id, so
 * moving to another session reads that one's.
 */
export function useSidePane(sessionId: string) {
  const [kept, setKept] = useState(() => storedSidePane(sessionId));
  const update = (next: KeptSidePane) => {
    rememberSidePane(sessionId, next);
    setKept(next);
  };
  return {
    kept,
    /** Open an item, or show it when it is open already. */
    open: (item: KeptSideItem) => update(openKept(kept, item)),
    /** Show the tab `key`; null is the launcher. */
    show: (key: string | null) => update({ ...kept, active: key }),
    /**
     * Close the tab `key`, a kept item's or a terminal's, given the tabs in
     * the order they are drawn, so a neighbour shows in its place.
     */
    close: (key: string, order: readonly string[]) =>
      update({
        items: kept.items.filter((item) => sideItemKey(item) !== key),
        active: closeTab(order, kept.active, key),
      }),
  };
}
