/**
 * The catalog drift check, against source text. The repository passing says
 * only that today's catalog and exports agree; these are the drifts that must
 * fail and the shapes that must not.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogProblems, sourceExports } from './ui-catalog.mjs';

const designSystem = `
export type { BadgeProps } from './components/badge';
export { Badge, badgeVariants } from './components/badge';
export {
  Dialog,
  DialogBody,
  DialogContent,
} from './components/dialog';
export { useNow } from './hooks/use-now';
`;
const table = (rows) =>
  [
    '| Need | Use | Not |',
    '| --- | --- | --- |',
    ...rows.map(([need, use, not]) => `| ${need} | ${use} | ${not} |`),
  ].join('\n');
const run = ({ rows, kit = [], uncatalogued = new Map() }) =>
  catalogProblems({
    docs: [{ file: 'catalog.md', text: table(rows) }],
    designSystem,
    kit: new Set(kit),
    uncatalogued,
  });

const covered = [
  ['Lifecycle state', '`Badge` with `active`', '`secondary`'],
  ['A tall dialog', '`DialogBody` around its middle', '`overflow-y-auto` on `DialogContent`'],
];

test('a catalog that names exported components and covers every module passes', () => {
  assert.deepEqual(run({ rows: covered }), []);
});

test('a row whose component is not exported fails on its line', () => {
  const problems = run({ rows: [...covered, ['A fold', '`Collapsible`', 'a chevron']] });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^catalog\.md:5: `Collapsible` is not exported/);
});

test('a component the kit exports, or a part of a kit compound, is a valid row', () => {
  const kit = sourceExports(
    'export const QueryState = Object.assign(QueryStateRoot, {\n  Pending: QueryStatePending,\n  Error,\n});',
  );
  const rows = [...covered, ['A read', "the kit's `QueryState`: `Pending`, `Error`", 'a ternary']];
  assert.deepEqual(run({ rows, kit: [...kit] }), []);
});

test('only the Use column is checked: a rival in the Not column need not exist', () => {
  const rows = [...covered, ['A note', '`Badge`', 'a hand-built `Banner`']];
  assert.deepEqual(run({ rows }), []);
});

test('a design-system module no row names fails, unless UNCATALOGUED gives a reason', () => {
  const rows = [covered[0]];
  assert.match(
    run({ rows })[0],
    /^\.\/components\/dialog \(Dialog, DialogBody, DialogContent\): exported/,
  );
  const uncatalogued = new Map([['./components/dialog', 'a reason']]);
  assert.deepEqual(run({ rows, uncatalogued }), []);
});

test('one part named covers its module; hooks and type exports need no row', () => {
  assert.deepEqual(run({ rows: [covered[0], ['A dialog', '`Dialog`', 'a div']] }), []);
});

test('a skip-list entry goes stale once its module has a row or leaves the index', () => {
  const uncatalogued = new Map([
    ['./components/badge', 'a reason'],
    ['./components/gone', 'a reason'],
  ]);
  const problems = run({ rows: covered, uncatalogued });
  assert.equal(problems.length, 2);
  assert.match(problems[0], /\.\/components\/badge has a catalog row now/);
  assert.match(problems[1], /\.\/components\/gone, which the index no longer exports/);
});
