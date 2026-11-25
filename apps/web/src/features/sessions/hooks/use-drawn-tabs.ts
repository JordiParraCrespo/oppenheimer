import { useBots, useSessions } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useState } from 'react';
import {
  openTabOf,
  readDrawnTabCount,
  withPlaceholdersCapped,
  writeDrawnTabCount,
} from '../lib/open-tabs';
import { useOpenTabs } from './use-open-tabs';

/**
 * The tabs the strip draws, in order: the device's open tabs with the page
 * on screen among them, less any whose session or bot its list has answered
 * without (deleted here or on another device). The page on screen keeps its
 * tab whatever the lists say. The sessions are handed back for the strip to
 * draw their tabs from.
 *
 * While a list loads its tabs are placeholders, no more of them than the
 * strip drew last time on this device (`readDrawnTabCount`): the stored tabs
 * can still name sessions deleted since, which would otherwise each draw one.
 */
export function useDrawnTabs(shownKey: string | null) {
  const tabs = useOpenTabs(shownKey);
  const [lastCount] = useState(readDrawnTabCount);
  const {
    data: sessions,
    isPending: sessionsPending,
    isSuccess: sessionsAnswered,
  } = useSessions({
    select: (list) => new Map(list.map((session) => [session.id, session])),
  });
  const {
    data: botIds,
    isPending: botsPending,
    isSuccess: botsAnswered,
  } = useBots({
    select: (list) => new Set(list.map((one) => one.id)),
  });
  const listed = tabs.keys.flatMap((key) => {
    const tab = openTabOf(key);
    if (!tab) return [];
    if (key === shownKey) return [{ key, tab, placeholder: false }];
    // While its list is loading a tab keeps its place, drawn as a placeholder,
    // so the tabs that are there do not shrink when it lands.
    if (tab.kind === 'session') {
      if (sessionsPending) return [{ key, tab, placeholder: true }];
      return sessions?.has(tab.id) ? [{ key, tab, placeholder: false }] : [];
    }
    if (botsPending) return [{ key, tab, placeholder: true }];
    return botIds?.has(tab.id) ? [{ key, tab, placeholder: false }] : [];
  });
  const drawn = withPlaceholdersCapped(listed, lastCount).map(({ key, tab }) => ({ key, tab }));
  const settled = sessionsAnswered && botsAnswered ? drawn.length : null;
  // Remembers the count on this device (localStorage) for the next load's placeholders.
  useEffect(() => {
    if (settled !== null) writeDrawnTabCount(settled);
  }, [settled]);
  return { drawn, sessions, close: tabs.close, reorder: tabs.reorder };
}
