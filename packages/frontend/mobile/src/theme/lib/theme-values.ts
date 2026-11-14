/**
 * Oppenheimer brand colours for the places that need a plain JS value rather
 * than a NativeWind class — React Navigation, status bars, chart series, the
 * odd inline `style`. They are the tokens in `apps/mobile/global.css`, read as
 * plain values; `__tests__/theme-values.spec.ts` fails when the two disagree.
 */
export const THEME = {
  light: {
    background: 'hsl(0 0% 100%)',
    foreground: 'hsl(240 3.3% 11.8%)', // ink-900  #1D1D1F
    mutedForeground: 'hsl(240 2.2% 44.1%)', // ink-600  #6E6E73
    tertiaryForeground: 'hsl(240 2.1% 53.5%)', // ink-400  #86868B
    card: 'hsl(0 0% 100%)',
    canvas: 'hsl(0 0% 100%)',
    primary: 'hsl(210 100% 44.5%)', // #0071E3 one blue for actions
    primaryForeground: 'hsl(0 0% 100%)',
    destructive: 'hsl(358 80.8% 53.1%)', // #E8272C
    border: 'hsl(240 5.9% 83.3%)', // #D2D2D7
    accentBlue: 'hsl(210 100% 44.5%)',
    statusActive: 'hsl(145 96.5% 33.9%)', // #03AA49
  },
  dark: {
    background: 'hsl(240 2.7% 7.3%)', // #121213
    foreground: 'hsl(240 11.1% 96.5%)', // #F5F5F7
    mutedForeground: 'hsl(240 2.9% 66.1%)', // #A6A6AB
    tertiaryForeground: 'hsl(240 2.1% 53.5%)', // #86868B
    card: 'hsl(240 3.7% 10.6%)', // #1A1A1C
    canvas: 'hsl(240 2.7% 7.3%)',
    primary: 'hsl(210 100% 44.5%)',
    primaryForeground: 'hsl(0 0% 100%)',
    destructive: 'hsl(3 100% 61.4%)', // #FF453A
    border: 'hsl(240 4.7% 21%)', // #333338
    accentBlue: 'hsl(210 100% 44.5%)',
    statusActive: 'hsl(145 96.5% 33.9%)',
  },
} as const;
