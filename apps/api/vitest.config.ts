import { globSync, readFileSync } from 'node:fs';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const include = ['src/**/*.spec.ts'];
// Integration suites need Docker (`pnpm test:integration`); the relay e2e
// builds the Go runner (`pnpm test:relay-e2e`).
const exclude = ['src/**/*.integration.spec.ts', 'src/**/*.e2e.spec.ts'];

/**
 * A spec that replaces a module changes what every later file in the same
 * worker imports, so it cannot share a module graph. The list is read from the
 * sources, not kept by hand: a new spec that calls one of these lands in the
 * isolated project by itself. What a shared spec may still leave behind (fake
 * timers, `process.env`, a global assigned by hand) is put back and fails that
 * spec, through `vitest.shared-guard.ts`.
 *
 * Whitespace and line breaks may sit anywhere in the call (`vi\n  .mock(`).
 * `vi.hoisted` replaces nothing on its own; it only feeds a `vi.mock` factory.
 */
const MODULE_MOCK = /\bvi\s*\.\s*(?:mock|doMock|unmock|doUnmock)\s*\(/;

const mocks = (file: string) => MODULE_MOCK.test(readFileSync(file, 'utf8'));

const isolated = globSync(include, { exclude }).filter(mocks);

// The scan reads specs only, so a module mock written anywhere else (a helper
// a spec imports) would leave that spec in the shared project with the mock
// leaking out of it. Refuse to run instead.
const hidden = globSync('src/**/*.ts', { exclude: ['src/**/*.spec.ts'] }).filter(mocks);
if (hidden.length > 0) {
  throw new Error(
    `vi.mock outside a spec is invisible to the isolation scan: ${hidden.join(', ')}. ` +
      'Call it in each spec that needs the mock.',
  );
}

export default defineConfig({
  // The SWC plugin emits the decorator metadata NestJS relies on for
  // constructor-based dependency injection.
  plugins: [swc.vite()],
  test: {
    globals: true,
    root: './',
    setupFiles: ['./vitest.setup.ts'],
    // `vi.stubEnv` and `vi.stubGlobal` are undone before every test.
    unstubEnvs: true,
    unstubGlobals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'shared',
          include,
          exclude: [...exclude, ...isolated],
          // One module graph per worker instead of one per file: the suite's
          // time is mostly importing Nest and its graph, not running tests.
          isolate: false,
          setupFiles: ['./vitest.shared-guard.ts'],
        },
      },
      {
        extends: true,
        test: { name: 'isolated', include: isolated, isolate: true },
      },
    ],
  },
});
