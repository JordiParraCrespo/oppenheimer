import { useUserSettings } from '@oppenheimer/frontend-core/react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { hasStoredTheme, useTheme } from '../../theme';
import { LOCALE_STORAGE_KEY } from '../lib/i18n';

/**
 * Makes the saved preferences this device's defaults.
 *
 * The server's copy is the cross-device default, not the truth about what
 * this browser is currently showing: theme and language are also chosen per
 * device (the chrome bar's toggle, the account menu's language list) and those
 * choices are stored locally. So the saved values are applied **once per
 * shell mount, and only where the device has not chosen for itself** — a
 * laptop that picked dark stays dark whatever the phone saved, and a signed-out
 * screen keeps reading the local choice. `system` is one of the three saved
 * values, not an absence of one: the account menu offers "Match system" and
 * the theme provider resolves it, so it applies like the other two.
 */
export function useApplyUserSettings(): void {
  const { i18n } = useTranslation();
  const { setTheme } = useTheme();
  const settings = useUserSettings();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current || !settings.data) return;
    applied.current = true;

    const { theme, locale } = settings.data;
    if (!hasStoredTheme()) setTheme(theme);

    let storedLocale: string | null = null;
    try {
      storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      // No storage: the detector already fell back to the browser's language.
    }
    if (!storedLocale && i18n.resolvedLanguage !== locale) void i18n.changeLanguage(locale);
  }, [settings.data, setTheme, i18n]);
}
