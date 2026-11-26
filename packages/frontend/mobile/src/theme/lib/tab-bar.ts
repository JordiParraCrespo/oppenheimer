import { THEME } from './theme-values';

/**
 * A theme colour with an alpha, as React Native parses it: `hsla(h, s, l, a)`.
 * RN reads the CSS4 form `hsl(h s l / a)` as no colour at all.
 */
export function withAlpha(hsl: string, alpha: number): string {
  const [h, s, l] = hsl
    .replace(/^hsl\(|\)$/g, '')
    .trim()
    .split(/\s+/);
  return `hsla(${h}, ${s}, ${l}, ${alpha})`;
}

/**
 * The Android tab bar (Material's navigation bar) in the app's own scheme and
 * blue, not Material's stock purple: the selected tab is the primary blue on a
 * pale pill of it. Passed whole, so the bar follows the app's light or dark
 * choice and not only the phone's.
 */
export const TAB_BAR = {
  light: tabBar(THEME.light),
  dark: tabBar(THEME.dark),
};

function tabBar(theme: (typeof THEME)['light' | 'dark']) {
  return {
    background: theme.card,
    icon: theme.mutedForeground,
    iconSelected: theme.primary,
    label: theme.mutedForeground,
    labelSelected: theme.foreground,
    indicator: withAlpha(theme.primary, 0.15),
    ripple: withAlpha(theme.primary, 0.12),
  };
}
