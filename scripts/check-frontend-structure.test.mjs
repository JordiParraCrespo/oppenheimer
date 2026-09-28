/**
 * The frontend layout contract, run against trees built for the purpose.
 *
 * Running the checker over the repository only says the repository conforms
 * today; it cannot exercise a rule nothing currently breaks. The script reads
 * the tree beside it, so each case copies it into a scratch root with a
 * minimal app and asserts on what it reports.
 *
 * The fixtures build `apps/web`, so the suite goes when that app does.
 */
// oppenheimer:begin web
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

const roots = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/**
 * A scratch repo holding `apps/web` with `files` (paths under the app), the
 * kernel module `users` and the product module `things`, and the checker's
 * report on it. `extra` holds files at other paths of the repo.
 */
function check(files, extra = {}) {
  const root = mkdtempSync(join(tmpdir(), 'oppenheimer-structure-'));
  roots.push(root);
  mkdirSync(join(root, 'scripts'));
  copyFileSync(
    new URL('./check-frontend-structure.mjs', import.meta.url),
    join(root, 'scripts/check-frontend-structure.mjs'),
  );
  // A feature is named after a module of the kernel or of the product package.
  mkdirSync(join(root, 'packages/frontend/core/src/modules/users'), { recursive: true });
  mkdirSync(join(root, 'packages/frontend/consumer/src/modules/things'), { recursive: true });
  // Every frontend surface carries an ARCHITECTURE.md; give the fixture its own.
  const docs = {
    'apps/web/ARCHITECTURE.md': '# web\n',
    'packages/frontend/ARCHITECTURE.md': '# frontend\n',
  };
  const all = {
    ...docs,
    ...Object.fromEntries(Object.entries(files).map(([path, body]) => [`apps/web/${path}`, body])),
    ...extra,
  };
  for (const [path, contents] of Object.entries(all)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  const run = spawnSync(process.execPath, [join(root, 'scripts/check-frontend-structure.mjs')], {
    encoding: 'utf8',
  });
  return { status: run.status, report: `${run.stdout}${run.stderr}` };
}

const LIST_SECTION = `export function ThingList({ rows }: { rows: string[] }) {
  return <ul>{rows.map((row) => <li key={row}>{row}</li>)}</ul>;
}
`;

test('a conforming feature passes', () => {
  const { status, report } = check({
    'src/features/things/screens/things.tsx': `import { ThingList } from '@/features/things/sections/thing-list';
export function ThingsScreen() {
  return <ThingList />;
}
`,
    'src/features/things/sections/thing-list.tsx': `import { useThings } from '@oppenheimer/frontend-consumer/react';
export function ThingList() {
  const things = useThings();
  return <ul>{things.data?.map((thing) => <li key={thing}>{thing}</li>)}</ul>;
}
`,
    'src/features/things/__tests__/fixtures/rows.ts': 'export const rows = [];\n',
    'src/routes/things.tsx': "export const Route = 'things';\n",
    'src/lib/nav.ts': 'export const NAV = [];\n',
  });
  assert.equal(status, 0, report);
  assert.match(report, /conform/);
});

test('a screen that subscribes only to feed one section is reported', () => {
  const { status, report } = check({
    'src/features/things/screens/things.tsx': `import { useThings } from '@oppenheimer/frontend-consumer/react';
import { ThingList } from '@/features/things/sections/thing-list';
export function ThingsScreen() {
  const things = useThings();
  return <ThingList rows={things.data} />;
}
`,
    'src/features/things/sections/thing-list.tsx': LIST_SECTION,
  });
  assert.equal(status, 1);
  assert.match(
    report,
    /screens\/things\.tsx: subscribes to `things` only to hand it to <ThingList \/> \(sections\/\)/,
  );
});

test('a value derived from the query counts as the query', () => {
  const { report } = check({
    'src/features/things/screens/things.tsx': `import { useThings } from '@oppenheimer/frontend-consumer/react';
import { ThingList } from '@/features/things/sections/thing-list';
export function ThingsScreen() {
  const things = useThings();
  const rows = things.data ?? [];
  return <ThingList rows={rows} />;
}
`,
  });
  assert.match(report, /subscribes to `rows` only to hand it to <ThingList \/>/);
});

test('handing a mutation to a form is the prescribed shape: a form cannot fetch', () => {
  const { report } = check({
    'src/features/things/sections/create-thing.tsx': `import { useCreateThing } from '@oppenheimer/frontend-consumer/react';
import { ThingForm } from '@/features/things/forms/thing-form';
export function CreateThing() {
  const create = useCreateThing();
  return <ThingForm pending={create.isPending} onSubmit={(values) => create.mutate(values)} />;
}
`,
  });
  assert.doesNotMatch(report, /subscribes to/);
});

test('two siblings sharing one result pass', () => {
  const { report } = check({
    'src/features/things/screens/things.tsx': `import { useThings } from '@oppenheimer/frontend-consumer/react';
import { ThingCount } from '@/features/things/sections/thing-count';
import { ThingList } from '@/features/things/sections/thing-list';
export function ThingsScreen() {
  const things = useThings();
  return (
    <>
      <ThingCount count={things.data} />
      <ThingList rows={things.data} />
    </>
  );
}
`,
  });
  assert.doesNotMatch(report, /subscribes to/);
});

test('a feature named after a page is reported; a module or an allowlisted name passes', () => {
  const { report } = check({
    'src/features/settings/screens/settings.tsx': 'export function SettingsScreen() {}\n',
    'src/features/users/screens/users.tsx': 'export function UsersScreen() {}\n',
    'src/features/automations/screens/automations.tsx': 'export function AutomationsScreen() {}\n',
    'src/features/public/screens/about.tsx': 'export function AboutScreen() {}\n',
  });
  assert.match(
    report,
    /features\/settings: not a module of @oppenheimer\/frontend-core or @oppenheimer\/frontend-consumer/,
  );
  assert.doesNotMatch(report, /features\/(users|automations|public): not a module/);
});

test('a feature holds only flat kind directories, with no barrel and no loose file', () => {
  const { report } = check({
    'src/features/things/panels/thing.tsx': 'export function Thing() {}\n',
    'src/features/things/components/rows/thing-row.tsx': 'export function ThingRow() {}\n',
    'src/features/things/screens/index.ts': "export * from './things';\n",
    'src/features/things/things.tsx': 'export function Things() {}\n',
    'src/features/loose.tsx': 'export function Loose() {}\n',
  });
  assert.match(report, /features\/things\/panels: not a kind directory/);
  assert.match(report, /features\/things\/components\/rows: a kind directory holds files/);
  assert.match(report, /features\/things\/screens\/index\.ts: no barrels inside a feature/);
  assert.match(report, /features\/things\/things\.tsx: a feature holds kind directories/);
  assert.match(report, /features\/loose\.tsx: a feature is a directory named after a module/);
});

test('a route file past 120 lines is reported, and one at the cap passes', () => {
  const lines = (count) => Array.from({ length: count }, () => '// composes').join('\n');
  const { report } = check({
    'src/routes/at-cap.tsx': lines(120),
    'src/routes/past-cap.tsx': lines(121),
  });
  assert.match(report, /apps\/web\/src\/routes\/past-cap\.tsx: 121 lines; a route file composes/);
  assert.doesNotMatch(report, /at-cap\.tsx/);
});

test("an app's lib/ holds configuration only", () => {
  const { report } = check({
    'src/lib/format-age.ts': 'export const formatAge = () => {};\n',
    'src/lib/oppenheimer.ts': 'export const app = {};\n',
  });
  assert.match(report, /apps\/web\/src\/lib\/format-age\.ts: an app's lib\/ holds only/);
  assert.doesNotMatch(report, /lib\/oppenheimer\.ts/);
});

test('an app file the kit already ships is reported', () => {
  const { report } = check(
    { 'src/features/things/components/page-head.tsx': 'export function PageHead() {}\n' },
    {
      'packages/frontend/web/src/layout/components/page-head.tsx':
        'export function PageHead() {}\n',
    },
  );
  assert.match(
    report,
    /features\/things\/components\/page-head\.tsx: @oppenheimer\/frontend-web already ships page-head\.tsx/,
  );
});

test('components/ at the app root is the pre-features layout', () => {
  const { report } = check({ 'src/components/thing.tsx': 'export function Thing() {}\n' });
  assert.match(report, /apps\/web\/src\/components: components live in src\/features/);
});
test("a product query hook on TanStack's own useQuery is reported; the core's passes", () => {
  const { report } = check(
    {},
    {
      'packages/frontend/consumer/src/react/things.queries.ts': `import { useMutation, useQuery } from '@tanstack/react-query';
export const useThings = () => useQuery({ queryKey: ['things'], queryFn: () => [] });
`,
      'packages/frontend/consumer/src/react/other.queries.ts': `import { useQuery } from '@oppenheimer/frontend-core/react';
import { useMutation } from '@tanstack/react-query';
export const useOther = () => useQuery({ queryKey: ['other'], queryFn: () => [] });
`,
    },
  );
  assert.match(report, /things\.queries\.ts: imports useQuery from @tanstack\/react-query/);
  assert.doesNotMatch(report, /other\.queries\.ts/);
});
test('two components side by side in an app file are reported; one passes', () => {
  const { report } = check({
    'src/features/things/sections/two.tsx': `export function ThingList() {
  return null;
}

function ThingRow() {
  return null;
}
`,
    'src/features/things/sections/typed.tsx': `export const ThingList: FC = () => null;
const ThingRow = memo(function Row() {
  return null;
});
`,
    'src/features/things/sections/one.tsx': `const LIMIT = 3;
export function ThingCount() {
  return LIMIT;
}
`,
  });
  assert.match(report, /sections\/two\.tsx: 2 components \(ThingList, ThingRow\)/);
  assert.match(report, /sections\/typed\.tsx: 2 components \(ThingList, ThingRow\)/);
  assert.doesNotMatch(report, /sections\/one\.tsx/);
});
// oppenheimer:end web
