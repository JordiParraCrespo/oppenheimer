import * as React from 'react';

type ColorScheme = 'light' | 'dark';

function read(): ColorScheme {
  return getComputedStyle(document.documentElement).colorScheme.includes('dark') ? 'dark' : 'light';
}

/**
 * The page's colour scheme as the tokens set it (`color-scheme` on the root,
 * which `.dark` and `[data-theme]` switch), for a library that themes in
 * JavaScript and would otherwise follow the OS instead of the app's switch.
 * Light until mounted, so a prerendered page and its first paint agree.
 */
function useColorScheme(): ColorScheme {
  const [scheme, setScheme] = React.useState<ColorScheme>('light');
  React.useEffect(() => {
    // The root's class and data-theme, which the theme switch writes.
    const root = document.documentElement;
    setScheme(read());
    const observer = new MutationObserver(() => setScheme(read()));
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    return () => observer.disconnect();
  }, []);
  return scheme;
}

export { useColorScheme };
export type { ColorScheme };
