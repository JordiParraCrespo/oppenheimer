import { useStoredList } from '@oppenheimer/frontend-web';
import { useEffect } from 'react';
import { OPEN_TABS_KEY, openTabOf, withTabOpen, withTabsOrdered } from '../lib/open-tabs';

/**
 * The tabs this device keeps open over Sessions, in their order (the reader
 * drags them into another, `reorder`), with the
 * page on screen among them (none on New session, which opens no tab): arriving on a session or a bot, by the sidebar,
 * a link or the address, opens its tab, or finds it open already. Every
 * reader on the page shares one list, another browser tab's change arrives
 * through the storage event, and a list storage refuses (private browsing,
 * a full quota) holds in memory until the page reloads.
 */
export function useOpenTabs(shownKey: string | null) {
  const [stored, setStored] = useStoredList(OPEN_TABS_KEY);
  // Syncs the device's open tabs (localStorage) with the page on screen.
  useEffect(() => {
    if (shownKey !== null) setStored((keys) => withTabOpen(keys, shownKey));
  }, [shownKey, setStored]);
  const keys = stored.filter((key) => openTabOf(key) !== null);
  return {
    keys: shownKey === null ? keys : withTabOpen(keys, shownKey),
    close: (closed: readonly string[]) =>
      setStored((current) => current.filter((one) => !closed.includes(one))),
    /** Keeps the tabs drawn in `order`, the reader's drag. */
    // A tab another browser tab closed while this drag was held stays closed.
    reorder: (order: readonly string[]) =>
      setStored((current) =>
        withTabsOrdered(
          current,
          order.filter((key) => key === shownKey || current.includes(key)),
        ),
      ),
  };
}
