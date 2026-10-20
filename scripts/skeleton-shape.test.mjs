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

test('a lone block the height of a guess is a slab, reported on the slot line', () => {
  assert.deepEqual(lines(pending('<Skeleton className="h-80 w-full" />')), [4]);
});

test('a block that fills its frame is a slab', () => {
  for (const classes of ['min-h-0 w-full flex-1', 'h-full w-full', 'min-h-40 w-full']) {
    assert.deepEqual(lines(pending(`<Skeleton className="${classes}" />`)), [4], classes);
  }
});

test('pixel and size heights count from 64px', () => {
  assert.deepEqual(lines(pending('<Skeleton className="h-[64px] w-full" />')), [4]);
  assert.deepEqual(lines(pending('<Skeleton className="size-16" />')), [4]);
  assert.deepEqual(lines(pending('<Skeleton className="h-[48px] w-full" />')), []);
});

test('several skeletons with one slab among them are a slab', () => {
  assert.deepEqual(
    lines(
      pending('<Skeleton className="h-6 w-40" />\n<Skeleton shape="lg" className="h-60 w-full" />'),
    ),
    [4],
  );
});

test('bars at the height of a line or a row pass', () => {
  assert.deepEqual(
    lines(pending('<Skeleton className="h-7.5 w-full" />\n<Skeleton className="h-7.5 w-full" />')),
    [],
  );
  assert.deepEqual(lines(pending('<Skeleton shape="sm" className="h-13.5 w-full" />')), []);
});

test('a named placeholder, or skeletons inside the real container, pass', () => {
  assert.deepEqual(lines(pending('<ThingListSkeleton />')), []);
  assert.deepEqual(
    lines(pending('<SettingsGroup>\n<Skeleton className="h-60 w-full" />\n</SettingsGroup>')),
    [],
  );
});

test('a slab that says why it stands in passes', () => {
  assert.deepEqual(
    lines(
      pending(
        '{/* A block stands in here: the terminal draws its first frame in place */}\n<Skeleton shape="none" className="min-h-0 w-full flex-1" />',
      ),
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
