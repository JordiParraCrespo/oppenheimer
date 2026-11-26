/**
 * The Android tab bar is coloured from `TAB_BAR`, and React Native reads a
 * colour it cannot parse as none at all: the bar's pill and ripple would
 * vanish without an error. The CSS4 alpha form `hsl(h s l / a)` is one such
 * colour, which is why `withAlpha` writes `hsla(h, s, l, a)`.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { TAB_BAR, withAlpha } from '../lib/tab-bar';

const normalizeColor: (color: string) => number | null = createRequire(import.meta.url)(
  '@react-native/normalize-colors',
);

describe('TAB_BAR', () => {
  it('holds only colours React Native can parse, in both schemes', () => {
    for (const scheme of [TAB_BAR.light, TAB_BAR.dark]) {
      for (const [role, color] of Object.entries(scheme)) {
        expect(normalizeColor(color), `${role}: ${color}`).not.toBeNull();
      }
    }
  });

  it('keeps the alpha withAlpha is given', () => {
    const rgba = normalizeColor(withAlpha('hsl(210 100% 44.5%)', 0.15)) as number;
    expect(rgba & 0xff).toBe(Math.round(0.15 * 255));
  });
});
