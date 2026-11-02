import { useEffect, useState } from 'react';
import { readState, type StoredState } from '@/sessions/store';

/**
 * What the service worker has stored, kept current while the popup is open.
 *
 * The outside system is `chrome.storage.local`, which the worker writes.
 */
export function useStoredState(): StoredState | undefined {
  const [state, setState] = useState<StoredState>();

  useEffect(() => {
    let live = true;
    const load = () => void readState().then((next) => live && setState(next));
    const onChanged = (_changes: unknown, area: string) => {
      if (area === 'local') load();
    };
    load();
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      live = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  return state;
}
