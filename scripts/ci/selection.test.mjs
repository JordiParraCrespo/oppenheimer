// What a changed file outside every package does to a CI run. The regression
// each case guards: a budget bump or a check's own edit forcing a full run
// again, or a CI script edit that stops forcing one.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiSuitesNeeded, classify } from './selection.mjs';

test('the pipeline, the lockfile and the workflow still force a full run', () => {
  for (const file of [
    'scripts/ci/local.mjs',
    'scripts/ci/plan.mjs',
    'scripts/stack/stack.mjs',
    'pnpm-lock.yaml',
    'turbo.json',
    '.github/workflows/ci.yml',
  ]) {
    assert.deepEqual(classify([file]).global, [file], file);
  }
});

test('a repo check the lint job runs, or its test, selects nothing', () => {
  const files = [
    'scripts/check-feature-flags.mjs',
    'scripts/check-feature-flags.test.mjs',
    'scripts/check-api-structure.mjs',
  ];
  assert.deepEqual(classify(files), { global: [], lintOnly: files, owners: [] });
});

// oppenheimer:begin web
test("the frontend's checks and their helpers select nothing", () => {
  const files = [
    'scripts/check-frontend-structure.mjs',
    'scripts/check-frontend-structure.test.mjs',
    'scripts/check-react-compiler.mjs',
    'scripts/skeleton-slab-debt.mjs',
    'scripts/query-state-slots.test.mjs',
    'scripts/ui-catalog.mjs',
  ];
  assert.deepEqual(classify(files), { global: [], lintOnly: files, owners: [] });
});
// oppenheimer:end web

test("an eval's cases select nothing", () => {
  const file = 'scripts/evals/frontend-audit/cases/u7-slab/case.json';
  assert.deepEqual(classify([file]), { global: [], lintOnly: [file], owners: [] });
});

// oppenheimer:begin web
test('the bundle check selects the app it weighs, not everything', () => {
  assert.deepEqual(classify(['scripts/check-bundle-size.mjs']), {
    global: [],
    lintOnly: [],
    owners: ['@oppenheimer/web'],
  });
});
// oppenheimer:end web

test('a check the test job runs is not taken for a lint-only one', () => {
  // `check:public-api` runs in the test job, so its edit must still run it.
  assert.deepEqual(classify(['scripts/check-backend-public-api.mjs']).global, [
    'scripts/check-backend-public-api.mjs',
  ]);
});

test('one global file in a mixed diff is enough for a full run', () => {
  const { global, lintOnly } = classify([
    'apps/api/src/main.ts',
    'scripts/check-feature-flags.mjs',
    'pnpm-lock.yaml',
  ]);
  assert.deepEqual(global, ['pnpm-lock.yaml']);
  assert.deepEqual(lintOnly, ['scripts/check-feature-flags.mjs']);
});

test("a package's own file is left to Turborepo", () => {
  assert.deepEqual(classify(['apps/api/src/main.ts', 'packages/shared/src/index.ts']), {
    global: [],
    lintOnly: [],
    owners: [],
  });
});

const API_DIRS = ['apps/api', 'packages/translations', 'packages/backend/i18n'];

test("the console's copy alone gives the API's suites nothing to check", () => {
  assert.equal(
    apiSuitesNeeded(
      [
        'packages/translations/en/sessions.json',
        'packages/translations/es/sessions.json',
        'packages/translations/en/index.json',
        'packages/translations/en/browser.json',
        'packages/translations/es/index.json',
      ],
      API_DIRS,
    ),
    false,
  );
});

test('the copy the API renders, or anything else of its, runs them', () => {
  for (const file of [
    'packages/translations/en/emails.json',
    'packages/translations/es/errors.json',
    'packages/translations/namespaces.json',
    'packages/translations/locales.ts',
    'packages/backend/i18n/src/translator.ts',
    'apps/api/src/main.ts',
  ]) {
    assert.equal(
      apiSuitesNeeded([file, 'packages/translations/en/sessions.json'], API_DIRS),
      true,
      file,
    );
  }
});
