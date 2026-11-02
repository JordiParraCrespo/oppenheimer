// Which steps a selection runs, and what each waits for. The regressions
// these guard: two Turborepo builds of one package at once, the suites
// reaching an API built before this commit, a slow or unrelated step coming
// back on every run, and `--dirty` running more than the lint job.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { plan, teardown } from './plan.mjs';

const affected = (...packages) => ({
  scope: 'affected',
  packages,
  filters: packages.map((name) => `--filter=${name}`),
});
const everything = (...packages) => ({ scope: 'all', packages, filters: [] });
const names = (steps) => steps.map((s) => s.id);
const step = (steps, id) => steps.find((s) => s.id === id);

test('every step that reads dist/ waits for the one build', () => {
  const steps = plan(affected('@oppenheimer/api', '@oppenheimer/backend-core'));
  const builds = steps.filter(
    (s) => s.command === 'pnpm' && s.args[0] === 'turbo' && s.args[2] === 'build',
  );
  assert.deepEqual(names(builds), ['test/turbo build']);
  for (const id of ['lint/Architecture boundaries', 'lint/Typecheck', 'services/stack up']) {
    assert.deepEqual(step(steps, id).after, ['test/turbo build'], id);
  }
  // The stack is told not to build; the build includes what it starts.
  assert.ok(step(steps, 'services/stack up').args.includes('--no-build'));
  const build = step(steps, 'test/turbo build').args;
  assert.ok(build.includes('--filter=@oppenheimer/api'));
  assert.ok(build.includes('--filter=./packages/backend/*'));
});

test('the suites wait for the API this run started, and stop only the stale API first', () => {
  const steps = plan(affected('@oppenheimer/api'));
  assert.deepEqual(step(steps, 'services/stack down (a stale API)').args, [
    'scripts/stack/stack.mjs',
    'down',
    '--api',
  ]);
  assert.deepEqual(step(steps, 'integration/pnpm test:integration').after, ['services/stack up']);
  assert.deepEqual(step(steps, 'e2e/e2e:api').after, ['services/stack up']);
  // The services start at once, beside the build.
  assert.equal(step(steps, 'services/stack services').after, undefined);
});

test('a full run builds everything, without narrowing filters', () => {
  const steps = plan(everything('@oppenheimer/api', '@oppenheimer/web'));
  assert.deepEqual(step(steps, 'test/turbo build').args, ['turbo', 'run', 'build']);
});

// oppenheimer:begin web
test('a frontend-only change runs no stack, no backend public API and no go', () => {
  const steps = plan(affected('@oppenheimer/web', '@oppenheimer/frontend-web'));
  const jobs = new Set(steps.map((s) => s.job));
  assert.deepEqual([...jobs].sort(), ['lint', 'test']);
  assert.equal(step(steps, 'test/Backend public API'), undefined);
  // The web app is built once, by the build.
  assert.equal(steps.filter((s) => s.name === 'build the web app').length, 0);
  assert.ok(step(steps, 'test/First-load budgets'));
});
// oppenheimer:end web

test('a backend package runs the backend public API check', () => {
  assert.ok(step(plan(affected('@oppenheimer/backend-ddd')), 'test/Backend public API'));
});

// oppenheimer:begin runner
test('Go tests run once, in the go job, not again under Turborepo', () => {
  const steps = plan(affected('@oppenheimer/runner', '@oppenheimer/go-core'));
  assert.ok(step(steps, 'go/go test'));
  const test = step(steps, 'test/turbo test').args;
  assert.ok(test.includes('--filter=!@oppenheimer/go-*'));
  assert.ok(test.includes('--filter=!@oppenheimer/runner'));
});
// oppenheimer:end runner

test('a translations change checks the assembled catalogs', () => {
  const steps = plan(affected('@oppenheimer/translations'));
  assert.deepEqual(step(steps, 'lint/Translations assembled').args.at(-1), '--check');
});

// oppenheimer:begin web
test('the frontend audit eval runs when its cases change and on a full run, not otherwise', () => {
  const id = 'evals/Frontend audit eval fixtures';
  assert.equal(step(plan(affected('@oppenheimer/web')), id), undefined);
  const edited = {
    ...affected(),
    lintOnly: ['scripts/evals/frontend-audit/cases/u7-slab/case.json'],
  };
  assert.ok(step(plan(edited), id));
  // After the unit tests: run beside them it starved them past their timeouts.
  assert.deepEqual(step(plan(everything('@oppenheimer/web')), id).after, ['test/turbo test']);
});
// oppenheimer:end web

test('--dirty is the lint job alone, nothing that waits for a build or reads HEAD', () => {
  const steps = plan(affected('@oppenheimer/api', '@oppenheimer/web'), { dirty: true });
  assert.deepEqual([...new Set(steps.map((s) => s.job))], ['lint']);
  assert.ok(steps.every((s) => s.after === undefined));
  assert.equal(step(steps, 'lint/Audit evals stay plantable'), undefined);
});

test('--skip leaves a job out, and skipping both suites starts no stack', () => {
  const steps = plan(affected('@oppenheimer/api'), { skip: new Set(['integration', 'e2e']) });
  assert.ok(steps.every((s) => !['services', 'integration', 'e2e'].includes(s.job)));
  assert.equal(teardown(steps), null);
});

test('the stack is asked to come down after the run, keeping a console it serves', () => {
  const steps = plan(affected('@oppenheimer/api'));
  assert.deepEqual(teardown(steps), [
    'node',
    ['scripts/stack/stack.mjs', 'down', '--keep-console'],
  ]);
});

test('step ids are unique, and every wait names a step of the plan', () => {
  const steps = plan(everything('@oppenheimer/api', '@oppenheimer/web', '@oppenheimer/runner'));
  const ids = names(steps);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of steps) for (const id of s.after ?? []) assert.ok(ids.includes(id), id);
});

test('an API reached only through copy it never reads runs no suite, but its unit tests', () => {
  const steps = plan({
    ...affected('@oppenheimer/api', '@oppenheimer/translations'),
    apiSuites: false,
  });
  assert.ok(steps.every((s) => !['services', 'integration', 'e2e'].includes(s.job)));
  assert.ok(step(steps, 'test/turbo test').args.includes('--filter=@oppenheimer/api'));
});

// oppenheimer:begin extension
test("the extension's suite runs in Playwright's image where CI asks for it", () => {
  const id = 'test/Extension in Chromium';
  assert.equal(step(plan(affected('@oppenheimer/extension'), { env: {} }), id).command, 'pnpm');
  const docker = step(
    plan(affected('@oppenheimer/extension'), { env: { CI_EXTENSION_IN_DOCKER: '1' } }),
    id,
  );
  assert.equal(docker.command, 'docker');
  assert.match(docker.args.join(' '), /mcr\.microsoft\.com\/playwright:v\d+\.\d+\.\d+-noble/);
});
// oppenheimer:end extension

// oppenheimer:begin runner
test('Go waits for every step that rewrites the generated Go files', () => {
  const steps = plan(affected('@oppenheimer/shared', '@oppenheimer/runner'));
  assert.deepEqual(step(steps, 'go/go vet').after, [
    'test/turbo build',
    'test/Generated files unchanged',
  ]);
  for (const id of step(steps, 'go/go vet').after) assert.ok(step(steps, id), id);
  // A Go change alone regenerates nothing: it waits for the build only.
  assert.deepEqual(step(plan(affected('@oppenheimer/go-core')), 'go/go vet').after, [
    'test/turbo build',
  ]);
});
// oppenheimer:end runner
