import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `@xterm/addon-webgl` built mipmaps of each glyph-atlas page and sampled
 * them; glyphs added to a page afterwards (bold runs, a cell redrawn under
 * the hover background) never reached those levels, and Mesa drivers drew
 * them as solid blocks. `patches/@xterm__addon-webgl@*.patch` samples the
 * atlas with `LINEAR` min/mag filters and builds no mipmaps, as Orca does
 * (stablyai/orca#1743).
 *
 * The regression this guards is a version bump that installs the addon
 * without the patch. The patch edits the minified `lib/` bundles Vite ships,
 * so it does not carry over: on a bump, run `pnpm patch @xterm/addon-webgl`,
 * remove `generateMipmap` and set both filters to `LINEAR` in
 * `lib/addon-webgl.js`, `lib/addon-webgl.mjs` and `src/GlyphRenderer.ts`,
 * then `pnpm patch-commit`. This spec fails until that is done.
 */
describe('the patched WebGL addon', () => {
  const require = createRequire(import.meta.url);
  const lib = dirname(require.resolve('@xterm/addon-webgl'));

  it.each(['addon-webgl.js', 'addon-webgl.mjs'])(
    '%s samples the atlas without mipmaps',
    (bundle) => {
      const source = readFileSync(join(lib, bundle), 'utf8');
      expect(source).not.toContain('generateMipmap');
      expect(source).toMatch(/TEXTURE_MIN_FILTER\s*,\s*[\w$.]+\.LINEAR\b/);
    },
  );
});
