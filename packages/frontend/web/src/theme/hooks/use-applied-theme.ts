import { useEffect, useState } from 'react';
import type { Theme, ThemePreference } from '../components/theme-provider';

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
 * Resolves the account menu's choice (light, dark or "Match system") and keeps
 * `<html>` wearing the answer.
 *
 * Two systems outside React, one effect each: the `prefers-color-scheme` media
 * query, which "Match system" follows and which flips under us at sunset, and
 * `document.documentElement`, where Tailwind's `dark` variant and portalled
 * dialogs and toasts read the theme. `public/theme-init.js` already applied
 * the answer before first paint, so mount is a no-op.
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
