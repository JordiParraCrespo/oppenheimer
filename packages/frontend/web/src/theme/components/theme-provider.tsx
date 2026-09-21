import { createContext, useContext, useState } from 'react';
import { useAppliedTheme } from '../hooks/use-applied-theme';

/** What the account menu offers: the two explicit choices, and the OS's. */
export type ThemePreference = 'light' | 'dark' | 'system';
/** What `<html>` ends up wearing once "Match system" has been resolved. */
export type Theme = 'light' | 'dark';

/** localStorage key holding this device's own theme choice. */
export const THEME_STORAGE_KEY = 'theme';

const ThemeContext = createContext<{
  theme: ThemePreference;
  resolvedTheme: Theme;
  setTheme: (t: ThemePreference) => void;
}>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
});

function readStoredTheme(): ThemePreference | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark' || stored === 'light' || stored === 'system' ? stored : null;
  } catch {
    return null;
  }
}

/** Whether this device has picked a theme for itself, as opposed to inheriting one. */
export function hasStoredTheme(): boolean {
  return readStoredTheme() !== null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // "Match system" is the default the frames decided
  // (`product/versions/mvp/05-screens.md`): the brand is drawn light, but a
  // machine that is already dark should not be argued with on first run.
  const [theme, setThemeState] = useState<ThemePreference>(() => readStoredTheme() ?? 'system');
  const resolvedTheme = useAppliedTheme(theme);

  // Stored on an explicit choice, not on every render: `hasStoredTheme` is
  // what lets the signed-in user's saved preference become a device's default
  // without overriding a theme that device picked for itself. The preference
  // is what is stored, not the resolution — "Match system" has to survive a
  // reload as itself, or it would freeze into whichever appearance was on.
  const setTheme = (next: ThemePreference) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage unavailable: the choice lasts for the session only.
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
