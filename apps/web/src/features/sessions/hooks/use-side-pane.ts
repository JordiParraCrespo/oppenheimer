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
 *
 * Every change applies to the pane as it is when it lands, never as it was
 * when it was asked for: a terminal opens over a round trip to the host, and
 * a bot or a session opened meanwhile must survive its tab being shown.
 */
export function useSidePane(sessionId: string) {
  const [kept, setKept] = useState(() => storedSidePane(sessionId));
  const update = (change: (pane: KeptSidePane) => KeptSidePane) =>
    setKept((pane) => {
      const next = change(pane);
      rememberSidePane(sessionId, next);
      return next;
    });
  return {
    kept,
    /** Open an item, or show it when it is open already. */
    open: (item: KeptSideItem) => update((pane) => openKept(pane, item)),
    /** Show the tab `key`; null is the launcher. */
    show: (key: string | null) => update((pane) => ({ ...pane, active: key })),
    /**
     * Close the tab `key`, a kept item's or a terminal's, given the tabs in
     * the order they are drawn, so a neighbour shows in its place.
     */
    close: (key: string, order: readonly string[]) =>
      update((pane) => ({
        items: pane.items.filter((item) => sideItemKey(item) !== key),
        active: closeTab(order, pane.active, key),
      })),
  };
}
