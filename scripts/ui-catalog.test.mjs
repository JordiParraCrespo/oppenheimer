/**
 * The catalog drift check. The repository passing says only that today's
 * catalog and exports agree; these are the drifts that must fail and the
 * shapes that must not. The export side runs the compiler over small
 * fixture packages; the catalog side is the pure comparison.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { catalogProblems, publicExports, uncataloguedReason } from './ui-catalog.mjs';

const dirs = [];
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'oppenheimer-ui-catalog-'));
  dirs.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const table = (rows) =>
  [
    '| Need | Use | Not |',
    '| --- | --- | --- |',
    ...rows.map(([need, use, not]) => `| ${need} | ${use} | ${not} |`),
  ].join('\n');
const modules = {
  'badge.tsx': 'export function Badge() { return null; }\n',
  'dialog.tsx':
    '// uncatalogued: a reason\nexport function Dialog() { return null; }\nexport function DialogBody() { return null; }\n',
};
const designSystem = new Map([
  ['Badge', 'badge.tsx'],
  ['Dialog', 'dialog.tsx'],
  ['DialogBody', 'dialog.tsx'],
  ['badgeVariants', 'badge.tsx'],
]);
const run = (rows, { kit = [], sources = modules } = {}) =>
  catalogProblems({
    docs: [{ file: 'catalog.md', text: table(rows) }],
    designSystem,
    kit: new Set(kit),
    readModule: (file) => sources[file],
  });
const badge = ['Lifecycle state', '`Badge` with `active`', '`secondary`'];
const dialog = ['A tall dialog', '`DialogBody` around its middle', '`overflow-y-auto`'];

test('rows that name public exports, and a marked module, pass', () => {
  assert.deepEqual(run([badge]), []);
});

test('a row whose component is not exported fails on its line', () => {
  const problems = run([badge, ['A fold', '`Collapsible`', 'a chevron']]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^catalog\.md:4: `Collapsible` is not a public export/);
});

test('a module named only in a Not column, or in prose, has no row and fails', () => {
  const sources = { ...modules, 'dialog.tsx': modules['dialog.tsx'].replace(/^\/\/.*\n/, '') };
  const notOnly = ['A note', '`Badge`', 'a `Dialog` of `div`s'];
  const problems = run([notOnly], { sources });
  assert.equal(problems.length, 1);
  assert.match(
    problems[0],
    /^dialog\.tsx \(Dialog, DialogBody\): exported by the design system but no catalog row/,
  );
});

test('one part named in a Use column covers its module; lower-case exports need no row', () => {
  const sources = { ...modules, 'dialog.tsx': modules['dialog.tsx'].replace(/^\/\/.*\n/, '') };
  assert.deepEqual(run([badge, dialog], { sources }), []);
});

test('a marker on a module that has a row is stale, and an empty reason fails', () => {
  assert.match(
    run([badge, dialog])[0],
    /^dialog\.tsx: has a catalog row, so its `\/\/ uncatalogued:` marker is stale/,
  );
  const sources = { ...modules, 'dialog.tsx': modules['dialog.tsx'].replace('a reason', '') };
  assert.match(run([badge], { sources })[0], /^dialog\.tsx: `\/\/ uncatalogued:` needs a reason/);
});

test('the marker is read from the top of the module only', () => {
  assert.equal(uncataloguedReason("'use client';\n// uncatalogued: why\n"), 'why');
  assert.equal(uncataloguedReason(`${'\n'.repeat(20)}// uncatalogued: why\n`), null);
});

test('exports resolve through the barrels: export *, type-only skipped, compound parts kept', () => {
  const root = fixture({
    'ds/src/index.ts':
      "export { Badge } from './components/badge';\nexport type { BadgeProps } from './components/badge';\nexport * from './more';\n",
    'ds/src/components/badge.tsx':
      'export type BadgeProps = {};\nexport function Badge() { return null; }\n',
    'ds/src/more.ts': "export { Chip } from './components/chip';\n",
    'ds/src/components/chip.tsx': 'export function Chip() { return null; }\n',
    'kit/src/index.ts': "export * from './layout';\nexport * as format from './format';\n",
    'kit/src/layout/index.ts': "export { QueryState } from './query-state';\n",
    'kit/src/layout/query-state.tsx':
      'function Root() { return null; }\nfunction Pending() { return null; }\nexport const QueryState = Object.assign(Root, { Pending, Data: Pending });\nexport function Hidden() { return null; }\n',
    'kit/src/format.ts': 'export const age = 1;\n',
  });
  const { designSystem: ds, kit } = publicExports(
    join(root, 'ds/src/index.ts'),
    join(root, 'kit/src/index.ts'),
  );
  assert.deepEqual([...ds.keys()].sort(), ['Badge', 'Chip']);
  assert.match(ds.get('Chip'), /components\/chip\.tsx$/);
  assert.ok(kit.has('QueryState') && kit.has('Pending') && kit.has('Data') && kit.has('format'));
  assert.ok(!kit.has('Hidden'), 'exported by its file but not by the barrel');
});

test('a kit component its file exports but the barrel does not fails its row', () => {
  const root = fixture({
    'ds/src/index.ts': "export { Badge } from './badge';\n",
    'ds/src/badge.tsx': 'export function Badge() { return null; }\n',
    'kit/src/index.ts': "export * from './forms';\n",
    'kit/src/forms/index.ts': "export { FieldNote } from './field-note';\n",
    'kit/src/forms/field-note.tsx': 'export function FieldNote() { return null; }\n',
    'kit/src/forms/error-alert.tsx': 'export function ErrorAlert() { return null; }\n',
  });
  const exports = publicExports(join(root, 'ds/src/index.ts'), join(root, 'kit/src/index.ts'));
  const problems = catalogProblems({
    docs: [
      {
        file: 'catalog.md',
        text: table([badge, ['A failure', "the kit's `ErrorAlert`", 'a div']]),
      },
    ],
    ...exports,
    readModule: () => '',
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^catalog\.md:4: `ErrorAlert` is not a public export/);
});
