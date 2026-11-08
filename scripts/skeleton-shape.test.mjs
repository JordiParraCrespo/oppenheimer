/**
 * The slab check, run against source text. The repository passing says only
 * that today's call sites conform; these are the shapes that must fail and
 * the ones that must not.
 */
// oppenheimer:begin web
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { skeletonSlabProblems } from './skeleton-shape.mjs';

const pending = (inside) => `export function ThingList() {
  return (
    <QueryState>
      <QueryState.Pending>
        ${inside}
      </QueryState.Pending>
      <QueryState.Error fallback="failed" />
      <QueryState.Data><ThingRows /></QueryState.Data>
    </QueryState>
  );
}
`;
const lines = (source) => skeletonSlabProblems(source).map(({ line }) => line);

test('a lone block the height of a guess is a slab, reported on its own line', () => {
  assert.deepEqual(lines(pending('<Skeleton className="h-80 w-full" />')), [5]);
});

test('a block that fills its frame is a slab', () => {
  for (const classes of ['min-h-0 w-full flex-1', 'h-full w-full', 'min-h-40 w-full']) {
    assert.deepEqual(lines(pending(`<Skeleton className="${classes}" />`)), [5], classes);
  }
});

test('a bar that fills its row is not a block', () => {
  assert.deepEqual(lines(pending('<Skeleton className="h-4 flex-1" />')), []);
});

test('pixel and size heights count from 64px', () => {
  assert.deepEqual(lines(pending('<Skeleton className="h-[64px] w-full" />')), [5]);
  assert.deepEqual(lines(pending('<Skeleton className="size-16" />')), [5]);
  assert.deepEqual(lines(pending('<Skeleton className="h-[48px] w-full" />')), []);
});

test('each slab among several skeletons is reported', () => {
  assert.deepEqual(
    lines(
      pending('<Skeleton className="h-6 w-40" />\n<Skeleton shape="lg" className="h-60 w-full" />'),
    ),
    [6],
  );
});

test('bars at the height of a line or a row pass', () => {
  assert.deepEqual(
    lines(pending('<Skeleton className="h-7.5 w-full" />\n<Skeleton className="h-7.5 w-full" />')),
    [],
  );
  assert.deepEqual(lines(pending('<Skeleton shape="sm" className="h-13.5 w-full" />')), []);
});

test('a named placeholder passes', () => {
  assert.deepEqual(lines(pending('<ThingListSkeleton />')), []);
});

test('a slab inside the real container is still a slab', () => {
  assert.deepEqual(
    lines(pending('<SettingsGroup>\n<Skeleton className="h-60 w-full" />\n</SettingsGroup>')),
    [6],
  );
});

test('a slab outside QueryState is a slab: a named placeholder, a pending branch', () => {
  assert.deepEqual(
    lines(
      'export function ThingSkeleton() {\n  return <Skeleton shape="lg" className="h-47.5 w-full" />;\n}\n',
    ),
    [2],
  );
  assert.deepEqual(
    lines('if (state === \'checking\') return <Skeleton className="h-40 w-full" />;\n'),
    [1],
  );
});

test('classes joined by cn are read', () => {
  assert.deepEqual(lines("<Skeleton className={cn('h-40', wide && 'w-full')} />\n"), [1]);
});

test('a template literal is read: its stated height counts, a run-time part is not guessed', () => {
  assert.deepEqual(lines('<Skeleton className={`h-64 ${width}`} />\n'), [1]);
  assert.deepEqual(lines('<Skeleton className={`min-w-0 flex-1 ${height}`} />\n'), []);
});

test('a `>` inside an attribute does not end the tag', () => {
  assert.deepEqual(lines("<Skeleton className={cn(a > b && 'h-64')} />\n"), [1]);
});

test('a floor of 64px or more is a slab, whatever height sits beside it', () => {
  assert.deepEqual(lines('<Skeleton className="h-4 min-h-96" />\n'), [1]);
});

test('a slab that says why it stands in passes, in its slot or just above it', () => {
  assert.deepEqual(
    lines(
      pending(
        '{/* A block stands in here: the terminal draws its first frame in place */}\n<Skeleton shape="none" className="min-h-0 w-full flex-1" />',
      ),
    ),
    [],
  );
  assert.deepEqual(
    lines(
      '<div>\n  {/* A block stands in here: the description field, at its own height */}\n  <Skeleton className="h-22 w-full" />\n</div>\n',
    ),
    [],
  );
});

test('a slab in a comment is not read', () => {
  assert.deepEqual(
    lines(
      `/**\n * <QueryState.Pending><Skeleton className="h-80 w-full" /></QueryState.Pending>\n */\n`,
    ),
    [],
  );
});
// oppenheimer:end web
