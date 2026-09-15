import '@oppenheimer/env/load';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import type { FixtureName } from '../fixtures/accounts.js';
import { applyFixture } from '../fixtures/index.js';
import { QA_ROOT, REPO_ROOT, REPORT_FILE, RESULTS_FILE, SCREENSHOTS_DIR } from './paths.js';
import { type RunResults, renderReport } from './report.js';
import { loadPack, requireScenario, searchableText } from './scenarios.js';

const USAGE = `
qa — the scenario pack runner

  qa env up|down|status     bring the simulation stack up, or report on it
  qa fixture <name>         put the database into a named state
  qa suite [--theme <id>] [--scenario <id>…]
                            run the scenarios (implies fixtures)
  qa coverage [--match <q>] inventory, or the scenarios that prove one thing
  qa report                 re-render the last run's report from results.json
  qa publish <pass-name>    copy a run's evidence into docs/screenshots/<pass>

Fixtures and scenarios are read from qa/scenarios. Adding a case means adding a
YAML file there and a spec bound to its id — nothing else registers it.
`.trim();

function run(command: string, args: string[]): number {
  const result = spawnSync(command, args, { cwd: QA_ROOT, stdio: 'inherit' });
  return result.status ?? 1;
}

function env(action: string): number {
  return run('bash', ['bin/qa-env.sh', action]);
}

async function fixture(name: string): Promise<number> {
  const applied = await applyFixture(name as FixtureName);
  if (!applied) {
    console.log(`fixture "${name}" applied — the pack's transient accounts are cleared`);
    return 0;
  }
  const { counts, organizationId, elapsedMs } = applied;
  console.log(
    `fixture "${name}" applied in ${elapsedMs}ms — workspace ${organizationId}: ` +
      `${counts.members} members, ${counts.teams} teams, ` +
      `${counts.pendingInvitations} pending invitations`,
  );
  return 0;
}

/** Every value given for a repeatable flag, e.g. `--scenario A --scenario B`. */
function flagValues(argv: string[], flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === flag && argv[index + 1]) values.push(argv[index + 1]);
  }
  return values;
}

function suite(argv: string[]): number {
  const themeIndex = argv.indexOf('--theme');
  const theme = themeIndex === -1 ? undefined : argv[themeIndex + 1];
  const scenarios = flagValues(argv, '--scenario');
  const args = ['exec', 'playwright', 'test'];
  if (theme) args.push(`specs/${theme}`);
  // Selecting by id rather than by file: a scenario is addressed by the id its
  // spec binds to, and `qa coverage --match` prints exactly this command, so the
  // two have to agree or the suggestion is a lie.
  if (scenarios.length > 0) {
    const pack = loadPack();
    for (const id of scenarios) requireScenario(pack, id);
    args.push('--grep', `(${scenarios.map((id) => `${id} —`).join('|')})`);
  }
  const status = run('pnpm', args);
  // The report is the point of the run, so render it whether or not the suite
  // passed — a red run is exactly when someone wants to read it.
  report();
  return status;
}

/** Which scenario ids a spec file binds to. That call is the only registration. */
function implementedIds(): Set<string> {
  const implemented = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = join(dir, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.name.endsWith('.spec.ts')) {
        for (const id of readFileSync(child, 'utf8').matchAll(/scenario\(\s*'([A-Z]+-\d+)'/g)) {
          implemented.add(id[1]);
        }
      }
    }
  };
  walk(resolve(QA_ROOT, 'specs'));
  return implemented;
}

/**
 * The inventory, or a search.
 *
 * Without a query this is the plain list, and a scenario that exists only as
 * YAML is reported as a plan rather than left to sit quietly inside a passing
 * suite. With `--match` it answers the question someone actually has after
 * touching a file: which scenario claims to prove this still works. The query
 * runs over ids, titles, coverage ids, docs refs and code refs, which is why
 * scenarios carry those at all.
 */
function coverage(argv: string[]): number {
  const pack = loadPack();
  const implemented = implementedIds();
  const matchIndex = argv.indexOf('--match');
  const query = matchIndex === -1 ? undefined : argv[matchIndex + 1]?.toLowerCase();

  if (query) {
    const hits = pack.scenarios.filter((scenario) => searchableText(scenario).includes(query));
    if (hits.length === 0) {
      console.log(`nothing in the pack mentions "${query}".`);
      console.log(
        'That is a finding in itself: the behaviour has no scenario claiming to prove it.',
      );
      return 1;
    }
    console.log(`${hits.length} scenario(s) matching "${query}":\n`);
    for (const scenario of hits) {
      const mark = implemented.has(scenario.id) ? '✔' : '·';
      console.log(`  ${mark} ${scenario.id}  ${scenario.title}`);
      const why = [
        ...scenario.coverage.primary.filter((id) => id.includes(query)).map((id) => `covers ${id}`),
        ...scenario.codeRefs
          .filter((ref) => ref.toLowerCase().includes(query))
          .map((r) => `code ${r}`),
        ...scenario.docsRefs
          .filter((ref) => ref.toLowerCase().includes(query))
          .map((r) => `docs ${r}`),
      ];
      if (why.length > 0) console.log(`      ${why.join(', ')}`);
    }
    console.log(`\n  pnpm qa suite --scenario ${hits.map((s) => s.id).join(' --scenario ')}`);
    return 0;
  }

  console.log(`${pack.pack} — v${pack.version}\n`);
  for (const theme of pack.themes) {
    const scenarios = pack.scenarios.filter((scenario) => scenario.theme === theme.id);
    console.log(`${theme.id}  ${theme.title}  (${scenarios.length})`);
    for (const scenario of scenarios) {
      const mark = implemented.has(scenario.id) ? '✔' : '·';
      const cases = scenario.cases.length > 0 ? `  [${scenario.cases.length} cases]` : '';
      console.log(
        `  ${mark} ${scenario.id.padEnd(8)} ${scenario.severity.padEnd(8)} ` +
          `${scenario.fixture.padEnd(9)} ${scenario.title}${cases}`,
      );
    }
    console.log('');
  }

  // A coverage id nothing primarily proves is the gap worth naming: something
  // in the taxonomy is claimed by no scenario that executes it.
  const primary = new Set(pack.scenarios.flatMap((scenario) => scenario.coverage.primary));
  const unproven = pack.coverageIds.filter((id) => !primary.has(id));
  const missing = pack.scenarios.filter((scenario) => !implemented.has(scenario.id));
  console.log(
    `${pack.scenarios.length} scenarios, ${pack.scenarios.length - missing.length} implemented` +
      (missing.length > 0
        ? `, ${missing.length} not yet: ${missing.map((s) => s.id).join(', ')}`
        : ''),
  );
  if (unproven.length > 0) {
    console.log(`\n${unproven.length} coverage id(s) with no primary proof:`);
    for (const id of unproven) console.log(`  · ${id}`);
  }
  return missing.length > 0 ? 1 : 0;
}

function report(): number {
  if (!existsSync(RESULTS_FILE)) {
    console.error('no results.json — run `qa suite` first');
    return 1;
  }
  const results = JSON.parse(readFileSync(RESULTS_FILE, 'utf8')) as RunResults;
  const markdown = renderReport(loadPack(), results);
  writeFileSync(REPORT_FILE, markdown);
  console.log(markdown);
  return 0;
}

/**
 * Copies a run's evidence into `docs/screenshots/<pass>/`, for keeps.
 *
 * The rewrite in the middle is the whole reason this is a command rather than
 * an instruction in a README. The report links its images as `screenshots/x.png`
 * because that is where they sit under `artifacts/`; published, the captures sit
 * flat beside the report, so every link has to become `./x.png`. Copying the two
 * across by hand leaves a report whose images are all broken — and the Markdown
 * still renders, so it is easy to miss until someone opens the file weeks later.
 */
function publish(passName: string | undefined): number {
  if (!passName) {
    console.error('usage: qa publish <pass-name>');
    return 2;
  }
  if (!existsSync(RESULTS_FILE) || !existsSync(REPORT_FILE)) {
    console.error('no run to publish — run `qa suite` first');
    return 1;
  }
  const target = join(REPO_ROOT, 'docs', 'screenshots', passName);
  mkdirSync(target, { recursive: true });

  const shots = existsSync(SCREENSHOTS_DIR)
    ? readdirSync(SCREENSHOTS_DIR).filter((file) => file.endsWith('.png'))
    : [];
  for (const file of shots) copyFileSync(join(SCREENSHOTS_DIR, file), join(target, file));

  const markdown = readFileSync(REPORT_FILE, 'utf8').replaceAll('](screenshots/', '](./');
  writeFileSync(join(target, 'run-report.md'), markdown);

  console.log(`published ${shots.length} capture(s) and the run report to ${target}`);
  console.log('Write a README.md there saying which captures settle a question, and why.');
  return 0;
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);
  switch (command) {
    case 'env':
      return env(rest[0] ?? 'up');
    case 'fixture':
      if (!rest[0]) {
        console.error('usage: qa fixture <name>');
        return 2;
      }
      return fixture(rest[0]);
    case 'suite':
      return suite(rest);
    case 'coverage':
      return coverage(rest);
    case 'report':
      return report();
    case 'publish':
      return publish(rest[0]);
    default:
      console.log(USAGE);
      return command ? 2 : 0;
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
