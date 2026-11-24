import { useStoredList } from '@oppenheimer/frontend-web';
import { useEffect } from 'react';
import { OPEN_TABS_KEY, openTabOf, withTabOpen } from '../lib/open-tabs';

/**
 * The tabs this device keeps open over Sessions, in their order, with the
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
    close: (key: string) => setStored((current) => current.filter((one) => one !== key)),
  };
}
