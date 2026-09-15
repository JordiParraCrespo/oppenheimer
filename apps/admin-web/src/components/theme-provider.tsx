import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

/** localStorage key holding this device's own theme choice. */
export const THEME_STORAGE_KEY = 'theme';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
}>({
  theme: 'light',
  setTheme: () => {},
});

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
  } catch {
    return null;
  }
}

/** Whether this device has picked a theme for itself, as opposed to inheriting one. */
export function hasStoredTheme(): boolean {
  return readStoredTheme() !== null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Light is the brand's default: every reference screen is drawn on the warm
  // off-white canvas, and dark is the opt-in.
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme() ?? 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  // Stored on an explicit choice, not on every render: `hasStoredTheme` is
  // what lets the signed-in user's saved preference become a device's default
  // without overriding a theme that device picked for itself.
  const setTheme = (next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage unavailable: the choice lasts for the session only.
    }
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
