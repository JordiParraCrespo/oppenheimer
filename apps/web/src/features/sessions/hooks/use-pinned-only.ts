import { useEffect, useState } from 'react';

/** Whether the sidebar draws only its pinned sessions, kept on this device. */
export const PINNED_ONLY_KEY = 'oppenheimer.sidebar.pinned-only';

/** Anything unreadable, or storage switched off, is off. */
function storedPinnedOnly(): boolean {
  try {
    return window.localStorage.getItem(PINNED_ONLY_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Whether the sidebar draws Pinned and no project, and the toggle the filter
 * menu's Pinned only flips. It outlives a reload, like a hidden project.
 */
export function usePinnedOnly() {
  const [pinnedOnly, setPinnedOnly] = useState(storedPinnedOnly);

  // Syncs the choice to localStorage; private browsing or a full quota keep it until a reload.
  useEffect(() => {
    try {
      window.localStorage.setItem(PINNED_ONLY_KEY, String(pinnedOnly));
    } catch {}
  }, [pinnedOnly]);

  return { pinnedOnly, setPinnedOnly };
}
