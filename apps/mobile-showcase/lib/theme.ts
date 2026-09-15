import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";

/**
 * Oppenheimer brand colours for the places that need a plain JS value rather
 * than a NativeWind class — React Navigation, status bars, chart series, the
 * odd inline `style`. Mirrors the tokens in `../global.css`; change both.
 */
export const THEME = {
  light: {
    background: "hsl(0 0% 100%)",
    foreground: "hsl(0 0% 16.1%)", // ink-900  #292929
    mutedForeground: "hsl(0 0% 36.5%)", // ink-600  #5D5D5D
    tertiaryForeground: "hsl(0 0% 62%)", // ink-400  #9E9E9E
    card: "hsl(0 0% 100%)",
    canvas: "hsl(40 14% 95.9%)", // #F6F5F3
    primary: "hsl(45 5% 15.7%)", // #2A2926 warm near-black CTA
    primaryForeground: "hsl(0 0% 100%)",
    destructive: "hsl(358 75% 59%)", // #E5484D
    border: "hsl(0 0% 90%)",
    accentBlue: "hsl(216 92% 58%)", // #2F80F6
    statusActive: "hsl(147 67% 37%)", // #1F9D57
  },
  dark: {
    background: "hsl(40 7% 8%)", // #161513
    foreground: "hsl(45 13% 93.7%)", // #F1F0ED
    mutedForeground: "hsl(48 3% 64.1%)", // #A6A5A1
    tertiaryForeground: "hsl(48 2% 42.5%)", // #6F6E6A
    card: "hsl(40 5% 11.2%)", // #1E1D1B
    canvas: "hsl(40 7% 8%)",
    primary: "hsl(45 13% 93.7%)",
    primaryForeground: "hsl(40 7% 8%)",
    destructive: "hsl(358 75% 59%)",
    border: "hsl(30 2% 20%)",
    accentBlue: "hsl(216 92% 58%)",
    statusActive: "hsl(147 67% 37%)",
  },
} as const;

export const NAV_THEME: Record<"light" | "dark", Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
};
