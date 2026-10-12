import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The WebGL addon used to build mipmaps of each glyph-atlas page and sample
 * them; glyphs added to a page afterwards never reached those levels, and
 * Mesa drivers drew them as solid blocks. `patches/@xterm__addon-webgl@*.patch`
 * removes the mipmaps. The regression this guards is a version bump that
 * installs the addon without the patch: the bundles Vite ships would call
 * `generateMipmap` again.
 */
describe('the patched WebGL addon', () => {
  const require = createRequire(import.meta.url);
  const lib = dirname(require.resolve('@xterm/addon-webgl'));

  it.each(['addon-webgl.js', 'addon-webgl.mjs'])(
    '%s samples the atlas without mipmaps',
    (bundle) => {
      const source = readFileSync(join(lib, bundle), 'utf8');
      expect(source).not.toContain('generateMipmap');
      expect(source).toMatch(/TEXTURE_MIN_FILTER,\w+\.LINEAR/);
    },
  );
});
