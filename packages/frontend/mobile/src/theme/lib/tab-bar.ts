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
 * The Android tab bar (Material's navigation bar), quiet and in the app's own
 * scheme rather than Material's stock purple: icons only, on the screen's own
 * background, the selected one in ink on a soft pill of it and the rest grey.
 * The brand blue stays on the controls and actions above it. Passed whole, so
 * the bar follows the app's light or dark choice and not only the phone's.
 */
export const TAB_BAR = {
  light: tabBar(THEME.light),
  dark: tabBar(THEME.dark),
};

function tabBar(theme: (typeof THEME)['light' | 'dark']) {
  return {
    background: theme.background,
    icon: theme.mutedForeground,
    iconSelected: theme.foreground,
    indicator: withAlpha(theme.foreground, 0.08),
    ripple: withAlpha(theme.foreground, 0.08),
  };
}
