import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The export map is four patterns, not a block per subpath, so a pattern that
 * stops matching a specifier fails silently: `@oppenheimer/shared/schemas/auth`
 * resolving to a file the build never wrote. This walks every subpath the
 * source can produce and resolves it through each condition.
 *
 * It reads the build, not the source, so it is skipped until `pnpm build` has
 * written `dist/esm/` (vitest itself runs against `src/`).
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  exports: Record<string, Record<string, string>>;
  sideEffects: string[];
};
const built = existsSync(join(root, 'dist', 'esm'));
const require = createRequire(join(root, 'package.json'));

/** Every subpath the source defines: `.`, each `src/<dir>/index.ts`, each schema, the catalog. */
function specifiers(): string[] {
  const src = join(root, 'src');
  const dirs = readdirSync(src, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(src, entry.name, 'index.ts')))
    .map((entry) => `./${entry.name}`);
  const schemas = readdirSync(join(src, 'schemas'))
    .filter((file) => file.endsWith('.schema.ts'))
    .map((file) => `./schemas/${file.slice(0, -'.schema.ts'.length)}`);
  return ['.', ...dirs, ...schemas, './feature-flags/catalog'];
}

/** Node's resolution of `exports`: an exact key, else the longest matching `*` pattern. */
function target(specifier: string, condition: string): string | undefined {
  const exact = pkg.exports[specifier];
  if (exact) return exact[condition];
  let best: { key: string; match: string } | undefined;
  for (const key of Object.keys(pkg.exports)) {
    const star = key.indexOf('*');
    if (star === -1) continue;
    const prefix = key.slice(0, star);
    const suffix = key.slice(star + 1);
    if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;
    if (specifier.length < key.length - 1) continue;
    if (best && prefix.length <= best.key.indexOf('*')) continue;
    best = { key, match: specifier.slice(prefix.length, specifier.length - suffix.length) };
  }
  return best && pkg.exports[best.key][condition]?.replaceAll('*', best.match);
}

describe.skipIf(!built)('the export map', () => {
  it.each(specifiers())('resolves %s through every condition', (specifier) => {
    for (const condition of ['types', 'import', 'require', 'default']) {
      const file = target(specifier, condition);
      expect(file, `${specifier} has no ${condition} target`).toBeDefined();
      expect(existsSync(join(root, file as string)), `${specifier} → ${file}`).toBe(true);
    }
    expect(target(specifier, 'import')).toMatch(/^\.\/dist\/esm\//);
    const name =
      specifier === '.' ? '@oppenheimer/shared' : `@oppenheimer/shared${specifier.slice(1)}`;
    expect(require.resolve(name)).toBe(join(root, target(specifier, 'require') as string));
  });

  it('sends ./schemas/auth to the schema file, and ./schemas to the barrel', () => {
    expect(target('./schemas/auth', 'import')).toBe('./dist/esm/schemas/auth.schema.js');
    expect(target('./schemas', 'import')).toBe('./dist/esm/schemas/index.js');
    expect(target('./feature-flags/catalog', 'import')).toBe('./dist/esm/feature-flags/catalog.js');
  });

  it('marks dist/esm as ES modules, with the side effects rebased onto it', () => {
    const esm = JSON.parse(readFileSync(join(root, 'dist', 'esm', 'package.json'), 'utf8'));
    expect(esm.type).toBe('module');
    const rebased = pkg.sideEffects
      .filter((path) => path.startsWith('./dist/esm/'))
      .map((path) => `./${path.slice('./dist/esm/'.length)}`);
    expect(esm.sideEffects).toEqual(rebased);
    for (const path of pkg.sideEffects) expect(existsSync(join(root, path)), path).toBe(true);
  });
});
