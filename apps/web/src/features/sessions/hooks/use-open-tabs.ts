import { useEffect, useSyncExternalStore } from 'react';
import { openTabs } from '../lib/open-tabs';

/**
 * The tabs this device keeps open over Sessions, in their order, with the
 * page on screen among them: arriving on a session or a bot, by the sidebar,
 * a link or the address, opens its tab, or finds it open already.
 */
export function useOpenTabs(shownKey: string) {
  const keys = useSyncExternalStore(openTabs.subscribe, openTabs.keys);
  // Syncs the device's open tabs (localStorage) with the page on screen.
  useEffect(() => openTabs.open(shownKey), [shownKey]);
  return { keys: keys.includes(shownKey) ? keys : [...keys, shownKey], close: openTabs.close };
}
