import { useEffect, useState } from 'react';

/** Anything unreadable, or storage switched off, is false. */
function storedBoolean(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

/**
 * A boolean kept on this device under `key`, like `useStoredList` for a list:
 * a toggle that outlives a reload. Private browsing or a full quota keep it
 * until the page reloads.
 */
export function useStoredBoolean(key: string) {
  const [value, setValue] = useState(() => storedBoolean(key));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, String(value));
    } catch {}
  }, [key, value]);

  return [value, setValue] as const;
}
