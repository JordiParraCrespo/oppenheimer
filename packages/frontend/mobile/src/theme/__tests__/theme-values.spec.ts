/**
 * `THEME` is what React Navigation, the status bar and inline styles colour
 * with; `apps/mobile/global.css` is what every NativeWind class reads. They are
 * two spellings of one palette, and this spec is what keeps them one: a token
 * changed in the CSS and not here (or the reverse) fails it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEME } from '../lib/theme-values';

const css = readFileSync(join(__dirname, '../../../../../../apps/mobile/global.css'), 'utf8');

/** The custom properties a block declares, by name. */
function tokens(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf('\n  }', start));
  return new Map(
    [...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
}

/** Which CSS token each `THEME` entry spells. */
const SOURCE: Record<keyof (typeof THEME)['light'], string> = {
  background: 'background',
  foreground: 'foreground',
  mutedForeground: 'muted-foreground',
  tertiaryForeground: 'ink-400',
  card: 'card',
  canvas: 'surface-canvas',
  primary: 'primary',
  primaryForeground: 'primary-foreground',
  destructive: 'destructive',
  border: 'border',
  accentBlue: 'accent-blue',
  statusActive: 'status-active',
};

describe('THEME', () => {
  const light = tokens(':root');
  // The dark block restates only what changes; the rest falls through to light.
  const dark = new Map([...light, ...tokens('.dark:root')]);

  it('found the token blocks it checks against', () => {
    expect(light.get('background')).toBeDefined();
    expect(tokens('.dark:root').get('background')).toBeDefined();
  });

  for (const [scheme, declared] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    it(`spells every ${scheme} colour the way global.css declares it`, () => {
      const drift = Object.entries(SOURCE).flatMap(([key, token]) => {
        const expected = `hsl(${declared.get(token)})`;
        const actual = THEME[scheme][key as keyof (typeof THEME)['light']];
        return actual === expected ? [] : [`${scheme}.${key}: ${actual} ≠ --${token} ${expected}`];
      });
      expect(drift).toEqual([]);
    });
  }
});
