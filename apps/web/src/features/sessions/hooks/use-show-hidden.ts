import { useEffect, useState } from 'react';

/** Whether the sidebar draws the hidden sessions too, kept on this device. */
const SHOW_HIDDEN_KEY = 'oppenheimer.sidebar.show-hidden';

/** Anything unreadable, or storage switched off, is off. */
function storedShowHidden(): boolean {
  try {
    return window.localStorage.getItem(SHOW_HIDDEN_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Whether the sidebar draws the sessions hidden by a bot, a script or the
 * reader, and the toggle the filter menu's Show hidden sessions flips. Which
 * sessions are hidden is the API's; whether to look at them is this device's.
 */
export function useShowHidden() {
  const [showHidden, setShowHidden] = useState(storedShowHidden);

  // Syncs the choice to localStorage; private browsing or a full quota keep it until a reload.
  useEffect(() => {
    try {
      window.localStorage.setItem(SHOW_HIDDEN_KEY, String(showHidden));
    } catch {}
  }, [showHidden]);

  return { showHidden, setShowHidden };
}
