import { useEffect, useState } from 'react';
import type { Theme, ThemePreference } from '../components/theme-provider';

/** The query the OS answers when it is asked which appearance it is wearing. */
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** The OS appearance right now, or light where the browser will not say. */
function readSystemTheme(): Theme {
  try {
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/**
 * Resolves the account menu's choice — light, dark or "Match system" — and
 * keeps `<html>` wearing the answer.
 *
 * Two systems outside React, one effect each: the `prefers-color-scheme`
 * media query, which is what "Match system" follows and which changes under
 * us when the OS flips at sunset, and `document.documentElement`, where
 * Tailwind's `dark` variant and the portalled dialogs and toasts read the
 * theme from. Neither runs on the first paint — `public/theme-init.js`
 * applied the same answer before the bundle did — so mount is a no-op and
 * every later change is an event.
 */
export function useAppliedTheme(preference: ThemePreference): Theme {
  const [system, setSystem] = useState<Theme>(readSystemTheme);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const sync = (event: MediaQueryListEvent) => setSystem(event.matches ? 'dark' : 'light');
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const resolved = preference === 'system' ? system : preference;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    document.documentElement.classList.toggle('light', resolved === 'light');
  }, [resolved]);

  return resolved;
}
