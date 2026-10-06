'use client';

import * as React from 'react';

/**
 * The showcase's theme owner: whether the page is dark, and the switch. The
 * pre-paint script sets the root before React runs; this reads it on mount,
 * follows it when something else flips it (the screenshot script does), and
 * writes it when the top bar's toggle is pressed. Components that theme in
 * JavaScript (`DiffView`) take the scheme from here as a prop.
 */
const ThemeContext = React.createContext<{ dark: boolean; setDark: (dark: boolean) => void }>({
  dark: false,
  setDark: () => {},
});

export function ShowcaseThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDarkState] = React.useState(false);
  React.useEffect(() => {
    // The root's class, which the pre-paint script and the toggle write.
    const root = document.documentElement;
    const read = () => setDarkState(root.classList.contains('dark'));
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  const setDark = React.useCallback((next: boolean) => {
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }, []);
  const value = React.useMemo(() => ({ dark, setDark }), [dark, setDark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useShowcaseTheme() {
  return React.useContext(ThemeContext);
}
