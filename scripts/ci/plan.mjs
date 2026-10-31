/**
 * The pipeline as data: every step `local.mjs` runs, which job it belongs to,
 * and what it waits for. Building the list runs nothing, so the selection is
 * testable (`plan.test.mjs`); `run.mjs` executes it.
 *
 * A step is `{ id, job, name, command, args, env?, after? }`. Steps of one job
 * run in order and the job stops at its first failure; jobs run side by side.
 * `after` names steps of other jobs this one waits for, and a step whose wait
 * failed does not run. The waits are what keeps two Turborepo runs from
 * building the same package at once: `test/turbo build` is the one build, and
 * everything that reads `dist/` waits for it.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const JOBS = ['lint', 'evals', 'go', 'test', 'services', 'integration', 'e2e'];
/** The jobs `--skip` accepts; `services` follows from integration and e2e. */
export const SKIPPABLE = ['lint', 'evals', 'go', 'test', 'integration', 'e2e'];

const BUILD = 'test/turbo build';

// oppenheimer:begin extension
/**
 * The extension's Playwright suite. With `CI_EXTENSION_IN_DOCKER` set it runs
 * in Playwright's own image for the installed version, which carries Chromium
 * and the system libraries it loads: the CI runner has neither, nor the root
 * to install them. The checkout is mounted at its own path so the hoisted
 * node_modules resolve, and the container runs as this user so what it
 * writes stays ours.
 */
function extensionSuite(env) {
  if (!env.CI_EXTENSION_IN_DOCKER) {
    return ['pnpm', ['--filter', '@oppenheimer/extension', 'e2e']];
  }
  const dir = join(ROOT, 'apps', 'extension');
  // Resolved as the extension resolves it: the linker hoists it to the root.
  const locate = createRequire(join(dir, 'package.json')).resolve;
  const { version } = JSON.parse(readFileSync(locate('@playwright/test/package.json'), 'utf8'));
  const user = `${process.getuid()}:${process.getgid()}`;
  const image = `mcr.microsoft.com/playwright:v${version}-noble`;
  const mount = `${ROOT}:${ROOT}`;
  const run = ['run', '--rm', '--ipc=host', '--user', user, '-e', 'HOME=/tmp', '-v', mount];
  return ['docker', [...run, '-w', dir, image, 'node', locate('@playwright/test/cli'), 'test']];
}
// oppenheimer:end extension
const STACK_UP = 'services/stack up';

/**
 * @param {object} selection  `affected.mjs`'s outputs: scope, packages,
 *   filters, lintOnly (the changed files only the lint job reads), apiSuites
 *   (false when the API is affected only through copy it never reads)
 * @param {object} options  dirty: lint only, on uncommitted work; skip: jobs
 *   left out; env: the environment (`CI_EXTENSION_IN_DOCKER`)
 */
export function plan(
  { scope, packages, filters, lintOnly = [], apiSuites = true },
  { dirty = false, skip = new Set(), env = process.env } = {},
) {
  const touches = (name) => packages.includes(name);
  const any = packages.length > 0;
  const steps = [];
  const add = (job, name, command, args, extra = {}) => {
    if (skip.has(job)) return;
    steps.push({ id: `${job}/${name}`, job, name, command, args, ...extra });
  };
  /** Waits for the build, when this run has one. */
  const afterBuild = () => (any && !dirty && !skip.has('test') ? { after: [BUILD] } : {});

  const apiChanged = touches('@oppenheimer/api') && apiSuites;
  const needsIntegration = !dirty && apiChanged && !skip.has('integration');
  // oppenheimer:begin e2e
  const needsE2e = !dirty && (apiChanged || touches('@oppenheimer/e2e')) && !skip.has('e2e');
  // oppenheimer:end e2e
  const needsStack = needsIntegration || needsE2e;
  // The backend packages' declarations, checked whatever else the diff touched.
  const needsPublicApi =
    scope === 'all' || packages.some((name) => name.startsWith('@oppenheimer/backend-'));

  // lint — always.
  // `pnpm check` is the contributor's command and writes the fixes it can; a
  // drift Biome could fix would then pass. Check without writing.
  add('lint', 'Biome', 'pnpm', ['exec', 'biome', 'check', '.']);
  add('lint', 'pnpm check:biome-plugins', 'pnpm', ['check:biome-plugins']);
  // oppenheimer:begin web|web-showcase
  add('lint', 'Design-system lint (reports, never fails)', 'pnpm', ['lint:design']);
  // oppenheimer:end web|web-showcase
  add('lint', 'API structure', 'pnpm', ['check:api-structure']);
  add('lint', 'Feature flags', 'pnpm', ['check:flags']);
  // The agent git guard (`.agents/hooks/git-guard.mjs`): its policy, case by case.
  add('lint', 'Agent git guard', 'pnpm', ['check:hooks']);
  add('lint', 'Dev bootstrap', 'pnpm', ['check:bootstrap']);
  // This pipeline's own selection and runner.
  add('lint', 'CI selection and runner', 'pnpm', ['check:ci']);
  // oppenheimer:begin runner
  // The runner release path's refusals: no keys, unsigned, tampered.
  add('lint', 'Runner release publishing', 'pnpm', ['check:runner-release']);
  // oppenheimer:end runner
  // oppenheimer:begin web
  add('lint', 'Frontend structure', 'pnpm', ['check:structure']);
  // The design-system catalog names only public components, and every
  // component has a row or an `// uncatalogued:` reason (`scripts/ui-catalog.mjs`).
  add('lint', 'UI catalog', 'pnpm', ['check:ui-catalog']);
  // The React Compiler gives up silently on a function it cannot compile (the
  // build prints nothing). The web tier is at zero bail-outs; keep it.
  add('lint', 'React Compiler bail-outs', 'pnpm', ['check:compiler', '--strict']);
  // Unused exports, files and dependencies in the console and the frontend
  // packages (knip, `knip.json`): an export nobody imports is deleted.
  add('lint', 'Unused code', 'pnpm', ['check:unused']);
  // `pnpm check:singletons`: apps/web's module-state libraries, once each.
  if (touches('@oppenheimer/web')) {
    add('lint', 'One copy of each React singleton', 'pnpm', ['check:singletons']);
  }
  // oppenheimer:end web
  // The assembled catalogs (`index.json`, `browser.json`) match their namespaces.
  if (touches('@oppenheimer/translations')) {
    add('lint', 'Translations assembled', 'node', [
      'packages/translations/scripts/assemble.mjs',
      '--check',
    ]);
  }
  if (!dirty) {
    // The hexagon audit's eval plants its violations by anchoring on exact
    // lines of apps/api; a refactor that moves one silently retires the eval.
    // Planting into a throwaway worktree of HEAD proves every anchor still
    // matches, so it has nothing to say about uncommitted work.
    add('lint', 'Audit evals stay plantable', 'sh', [
      '-c',
      'dir=$(mktemp -d) && git worktree add -q --detach "$dir/planted" HEAD && node .agents/routines/evals/hexagon-audit/plant.mjs "$dir/planted"; status=$?; git worktree remove --force "$dir/planted"; rm -rf "$dir"; exit $status',
    ]);
  }
  // oppenheimer:begin web
  // The frontend audit's fixtures: each case still typechecks, and the
  // mechanical checks fail only where the case says they should. Slow (a
  // worktree and a typecheck per case, six minutes), so it is a job of its
  // own, and runs when the eval changes and on the scheduled run, which
  // catches the console moving under a case.
  if (
    !dirty &&
    (scope === 'all' || lintOnly.some((f) => f.startsWith('scripts/evals/frontend-audit/')))
  ) {
    // After the unit tests, not beside them: the two are the run's heaviest
    // CPU, and together on four cores a synchronous 300ms test hit vitest's
    // five-second timeout.
    add(
      'evals',
      'Frontend audit eval fixtures',
      'node',
      ['scripts/evals/frontend-audit/run.mjs', '--validate'],
      any && !skip.has('test') ? { after: ['test/turbo test'] } : {},
    );
  }
  // oppenheimer:end web
  // oppenheimer:begin starter
  add('lint', 'Starter manifest', 'pnpm', ['starter:check']);
  // oppenheimer:end starter
  // Last: both read the workspace packages' `dist/`, so they wait for the build.
  if (any) {
    add(
      'lint',
      'Architecture boundaries',
      'pnpm',
      ['turbo', 'run', 'arch', ...filters],
      afterBuild(),
    );
    add('lint', 'Typecheck', 'pnpm', ['turbo', 'run', 'typecheck', ...filters], afterBuild());
  }

  if (dirty) return steps;

  // oppenheimer:begin runner
  let goTouched =
    packages.some((name) => name.startsWith('@oppenheimer/go-')) || touches('@oppenheimer/runner');
  // oppenheimer:begin e2e
  // e2e/netsim, the network simulator, is a Go module inside the e2e package.
  goTouched ||= touches('@oppenheimer/e2e');
  // oppenheimer:end e2e
  if (goTouched) {
    // After the build and the generated-files check: both have
    // `packages/shared` write the runner's `*.gen.go`, and a Go step reading
    // one mid-write fails to parse it.
    const regenerates = touches('@oppenheimer/shared') || touches('@oppenheimer/runner');
    const goAfter = afterBuild().after
      ? { after: [BUILD, ...(regenerates ? ['test/Generated files unchanged'] : [])] }
      : {};
    add('go', 'go vet', 'go', ['vet', 'github.com/jordiparracrespo/oppenheimer/...'], goAfter);
    // NUL-delimited, like `packages/go/Makefile`: unquoted, the module
    // directories split on the spaces in a checkout path and golangci-lint
    // lints nothing while reporting `0 issues`.
    add('go', 'golangci-lint', 'sh', [
      '-c',
      `go list -m -f '{{.Dir}}/...' | tr '\\n' '\\0' | xargs -0 golangci-lint run`,
    ]);
    add('go', 'go test', 'go', ['test', '-count=1', 'github.com/jordiparracrespo/oppenheimer/...']);
    add('go', 'build the runner', 'sh', [
      '-c',
      'cd apps/runner && go build -trimpath -o /dev/null ./cmd/runner',
    ]);
    for (const target of ['darwin/arm64', 'darwin/amd64', 'linux/arm64']) {
      const [goos, goarch] = target.split('/');
      add('go', `build for ${target}`, 'sh', [
        '-c',
        `cd apps/runner && GOOS=${goos} GOARCH=${goarch} go build -o /dev/null ./...`,
      ]);
    }
  }
  // oppenheimer:end runner

  if (any) {
    // The one build. A selection names its packages and Turborepo adds their
    // dependencies; what other steps read beyond them is named here, so they
    // never start a build of their own. A full run builds everything already.
    const extra = [];
    if (filters.length && needsPublicApi) extra.push('--filter=./packages/backend/*');
    if (filters.length && needsStack) extra.push('--filter=@oppenheimer/api');
    add('test', 'turbo build', 'pnpm', ['turbo', 'run', 'build', ...filters, ...extra]);
    // The backend packages must compile against their dependencies' built
    // declarations, every one of them, whenever any is affected.
    if (needsPublicApi) add('test', 'Backend public API', 'pnpm', ['check:public-api']);
    // oppenheimer:begin runner
    if (touches('@oppenheimer/shared') || touches('@oppenheimer/runner')) {
      add('test', 'Generated files are committed', 'pnpm', [
        '--filter',
        '@oppenheimer/shared',
        'run',
        'check:generated',
      ]);
      add('test', 'Generated files unchanged', 'git', [
        'diff',
        '--exit-code',
        '--',
        'packages/shared/protocol-schema',
        'apps/runner/internal',
      ]);
    }
    // oppenheimer:end runner
    // oppenheimer:begin runner
    // The go job runs every Go module's tests once; Turborepo would run them again.
    const notGo = goTouched ? ['--filter=!@oppenheimer/go-*', '--filter=!@oppenheimer/runner'] : [];
    // oppenheimer:end runner
    add('test', 'turbo test', 'pnpm', ['turbo', 'run', 'test', ...filters, ...notGo]);
    // oppenheimer:begin extension
    // The built extension in Chromium against a fake claude.ai: the page
    // tap, the poll, the badge, the notifications and the popup.
    if (touches('@oppenheimer/extension')) {
      add('test', 'Extension in Chromium', ...extensionSuite(env));
    }
    // oppenheimer:end extension
    // oppenheimer:begin web
    // The build above built the web app; this weighs it.
    if (touches('@oppenheimer/web')) add('test', 'First-load budgets', 'pnpm', ['check:bundle']);
    // oppenheimer:end web
  }

  // Both suites need the stack's services: `stack.mjs up` uses a Postgres and
  // Redis already listening (the workflow's service containers), and otherwise
  // starts them under Docker, starting the daemon in a sandbox that ships it
  // stopped. Testcontainers then needs that same daemon, so where Postgres and
  // Redis run outside Docker, Docker still has to be running. The services
  // start while the build runs; the API starts once it is built.
  if (needsStack) {
    // `up` leaves an API that is already answering alone, and that API may
    // be an earlier build or someone's dev server: the suites would test it,
    // not this commit. Stop the API the stack started before (and only it: a
    // console started with `--web` stays up for the screenshots), then insist
    // the port is free, so the API the suites reach is the one built here.
    add('services', 'stack down (a stale API)', 'node', [
      'scripts/stack/stack.mjs',
      'down',
      '--api',
    ]);
    add('services', 'nothing else answers on the API port', 'node', [
      'scripts/stack/stack.mjs',
      'api-port-free',
    ]);
    add('services', 'stack services', 'node', ['scripts/stack/stack.mjs', 'up', '--no-api']);
    add('services', 'stack up', 'node', ['scripts/stack/stack.mjs', 'up', '--no-build'], {
      after: [BUILD],
    });
    if (needsIntegration) {
      // Ryuk is one more image to pull from Docker Hub; every suite stops its
      // own containers.
      add('integration', 'pnpm test:integration', 'pnpm', ['test:integration'], {
        env: { TESTCONTAINERS_RYUK_DISABLED: 'true' },
        after: [STACK_UP],
      });
    }
    // oppenheimer:begin e2e
    if (needsE2e) {
      add('e2e', 'e2e:api', 'pnpm', ['--filter', '@oppenheimer/e2e', 'e2e:api'], {
        after: [STACK_UP],
      });
    }
    // oppenheimer:end e2e
  }

  return steps;
}

/** What to run once every step has finished, whatever happened. */
export function teardown(steps) {
  if (!steps.some((s) => s.job === 'services')) return null;
  // The stack decides: a console it serves (`up --web`, for the screenshots)
  // keeps it up, with the API this run built; otherwise it comes down.
  return ['node', ['scripts/stack/stack.mjs', 'down', '--keep-console']];
}
