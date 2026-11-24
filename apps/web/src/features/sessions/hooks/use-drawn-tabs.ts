import { useBots, useSessions } from '@oppenheimer/frontend-consumer/react';
import { openTabOf } from '../lib/open-tabs';
import { useOpenTabs } from './use-open-tabs';

/**
 * The tabs the strip draws, in order: the device's open tabs with the page
 * on screen among them, less any whose session or bot its list has answered
 * without (deleted here or on another device). The page on screen keeps its
 * tab whatever the lists say. The sessions are handed back for the strip to
 * draw their tabs from.
 */
export function useDrawnTabs(shownKey: string | null) {
  const tabs = useOpenTabs(shownKey);
  const { data: sessions } = useSessions({
    select: (list) => new Map(list.map((session) => [session.id, session])),
  });
  const { data: botIds } = useBots({ select: (list) => new Set(list.map((one) => one.id)) });
  const drawn = tabs.keys.flatMap((key) => {
    const tab = openTabOf(key);
    if (!tab) return [];
    if (key === shownKey) return [{ key, tab }];
    if (tab.kind === 'session' && !sessions?.has(tab.id)) return [];
    if (tab.kind === 'bot' && !botIds?.has(tab.id)) return [];
    return [{ key, tab }];
  });
  return { drawn, sessions, close: tabs.close };
}
