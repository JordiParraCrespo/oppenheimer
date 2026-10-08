import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The root `.env.example` is the documentation of every variable the API
 * reads, and lists nothing that nothing reads (`api-config.md`). Both
 * directions drift silently: an undocumented variable is a knob nobody knows
 * exists, and a documented one nothing reads is a knob an operator sets
 * expecting it to do something.
 *
 * The API's reads are found in source: `process.env.X` and `process.env['X']`
 * in the API and the packages it runs (`packages/backend/*`, `auth`, `env`),
 * the env names a config section hands `parseEnv`, and the seed's
 * `seedPassword('X')`. The example is shared with other apps, so a variable
 * the API does not read must be claimed by one of them in `OTHER_READERS`,
 * and the claim is checked against that reader's source.
 */

const REPO = resolve(__dirname, '../../../..');
const API_SRC = resolve(__dirname, '..');
const ENV_EXAMPLE = readFileSync(join(REPO, '.env.example'), 'utf8');

/**
 * Read by the API but not something to set: each with why it is not in the
 * example as an assignment.
 */
const INTERNAL: Record<string, string> = {
  OPENAPI_GENERATION: 'set by `pnpm generate:openapi` itself; the example says so in a comment',
};

/** Who else reads a variable the example lists, and where to find the read. */
const OTHER_READERS: { pattern: RegExp; reader: string; directory: string }[] = [
  // First match wins: `RUNNER_IMAGE` is the compose file's, not the runner's.
  { pattern: /_IMAGE$/, reader: 'the compose files', directory: 'docker' },
  { pattern: /^VITE_/, reader: 'the web console', directory: 'apps/web/src' },
  { pattern: /^RUNNER_/, reader: 'the Go runner', directory: 'apps/runner' },
  {
    pattern: /^SCHEMA_TEST_DATABASE_URL$/,
    reader: 'the schema integration suite',
    directory: 'apps/api/src/__tests__',
  },
];

const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', '__tests__', '.turbo']);

/** Production sources under `directory`; with `tests`, specs and `__tests__/` too. */
function sourceFiles(directory: string, extensions: RegExp, tests = false): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const skip = SKIP_DIRECTORIES.has(entry.name) && !(tests && entry.name === '__tests__');
      return skip ? [] : sourceFiles(path, extensions, tests);
    }
    return extensions.test(entry.name) && (tests || !entry.name.includes('.spec.')) ? [path] : [];
  });
}

function packageSources(): string[] {
  const backend = join(REPO, 'packages/backend');
  return [
    ...readdirSync(backend).map((name) => join(backend, name, 'src')),
    join(REPO, 'packages/auth/src'),
    join(REPO, 'packages/env/src'),
  ];
}

function readsIn(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const names = [
    ...source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g),
    ...source.matchAll(/process\.env\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\]/g),
    ...source.matchAll(/seedPassword\(\s*'([A-Z][A-Z0-9_]*)'/g),
  ].map((match) => match[1]);
  // A config section's `parseEnv` map: `key: 'ENV_NAME'`.
  if (/\/config\/[^/]+\.config\.ts$/.test(file) && source.includes('parseEnv(')) {
    names.push(...[...source.matchAll(/:\s*'([A-Z][A-Z0-9]*_[A-Z0-9_]+|PORT)'/g)].map((m) => m[1]));
  }
  return names;
}

const apiReads = new Set(
  [API_SRC, ...packageSources()].flatMap((directory) =>
    sourceFiles(directory, /\.tsx?$/).flatMap(readsIn),
  ),
);

/** Assigned in the example, commented out (`# NAME=`) included: an optional one documented off. */
const declared = new Set(
  ENV_EXAMPLE.split('\n')
    .map((line) => /^#?\s*([A-Z][A-Z0-9_]*)=/.exec(line.trim())?.[1])
    .filter((name): name is string => name !== undefined),
);

describe('environment coverage', () => {
  it('finds the reads and the declarations to compare', () => {
    expect(apiReads.size).toBeGreaterThan(60);
    expect(declared.size).toBeGreaterThan(80);
  });

  it('declares every variable the API reads in the root .env.example', () => {
    const undocumented = [...apiReads].filter((name) => !declared.has(name) && !(name in INTERNAL));
    expect(undocumented.sort()).toEqual([]);
  });

  it('keeps the internal ledger to variables that are still read', () => {
    expect(Object.keys(INTERNAL).filter((name) => !apiReads.has(name))).toEqual([]);
  });

  it('lists nothing in .env.example that neither the API nor a named reader uses', () => {
    const unread = [...declared].filter(
      (name) => !apiReads.has(name) && !OTHER_READERS.some(({ pattern }) => pattern.test(name)),
    );
    expect(unread.sort()).toEqual([]);
  });

  it('holds every claim another reader makes against that reader’s source', () => {
    const claimed = [...declared].filter((name) => !apiReads.has(name));
    const unfounded = claimed.flatMap((name) => {
      const owner = OTHER_READERS.find(({ pattern }) => pattern.test(name));
      if (!owner) return [];
      const files = sourceFiles(
        join(REPO, owner.directory),
        /\.(tsx?|go|ya?ml)$|^Dockerfile/,
        true,
      );
      const read = files.some((file) => readFileSync(file, 'utf8').includes(name));
      return read ? [] : [`${name}: not found in ${owner.reader} (${owner.directory})`];
    });
    expect(unfounded).toEqual([]);
  });
});
