/**
 * The QueryState slot check, run against source text. The repository passing
 * says only that today's call sites conform; these are the shapes that must
 * fail and the ones that must not.
 */
// oppenheimer:begin web
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { queryStateSlotProblems } from './query-state-slots.mjs';

const PENDING = '<QueryState.Pending>loading</QueryState.Pending>';
const ERROR = '<QueryState.Error fallback="failed" />';
const EMPTY = '<QueryState.Empty>none</QueryState.Empty>';
const DATA = '<QueryState.Data of={things}>{(rows) => rows.join()}</QueryState.Data>';

const section = (open, ...slots) => `export function ThingList() {
  return (
    ${open}
      ${slots.join('\n      ')}
    </QueryState>
  );
}
`;
const messages = (source) =>
  queryStateSlotProblems(source).map(({ line, message }) => `${line}: ${message}`);

test('every slot it needs passes, with and without isEmpty', () => {
  assert.deepEqual(messages(section('<QueryState query={things}>', PENDING, ERROR, DATA)), []);
  assert.deepEqual(
    messages(
      section(
        '<QueryState query={things} isEmpty={(rows) => rows.length === 0}>',
        PENDING,
        ERROR,
        EMPTY,
        DATA,
      ),
    ),
    [],
  );
});

test('a missing rung is reported on the root line, naming each slot', () => {
  const [problem] = messages(section('<QueryState query={things}>', PENDING));
  assert.match(problem, /^3: <QueryState> without QueryState\.Error, QueryState\.Data —/);
});

test('isEmpty without an Empty slot, and an Empty slot without isEmpty, are both reported', () => {
  assert.match(
    messages(
      section('<QueryState query={things} isEmpty={(rows) => !rows.length}>', PENDING, ERROR, DATA),
    )[0],
    /without QueryState\.Empty \(it is given isEmpty\)/,
  );
  assert.match(
    messages(section('<QueryState query={things}>', PENDING, ERROR, EMPTY, DATA))[0],
    /<QueryState\.Empty> with no isEmpty/,
  );
});

test('an arrow in a prop does not end the tag, and a comment does not count as a slot', () => {
  const source = section(
    '<QueryState query={things} isEmpty={(rows) => rows.length > 0}>',
    PENDING,
    '{/* <QueryState.Error fallback="x" /> */}',
    EMPTY,
    DATA,
  );
  assert.match(messages(source)[0], /without QueryState\.Error —/);
});

test('two roots in one file are each checked on their own line', () => {
  const source = `${section('<QueryState query={things}>', PENDING, ERROR, DATA)}${section('<QueryState query={things}>', PENDING, DATA)}`;
  assert.deepEqual(
    queryStateSlotProblems(source).map(({ line }) => line),
    [12],
  );
});

test("a nested root's slots do not count for the root around it", () => {
  const inner = `<QueryState query={things}>${PENDING}${ERROR}${DATA}</QueryState>`;
  const source = section(
    '<QueryState query={things}>',
    PENDING,
    `<QueryState.Data>{() => ${inner}}</QueryState.Data>`,
  );
  const reported = messages(source);
  assert.equal(reported.length, 1);
  assert.match(reported[0], /^3: <QueryState> without QueryState\.Error —/);
});
test('Data drawing another query than its root is reported', () => {
  const other = '<QueryState.Data of={others}>{(rows) => rows.join()}</QueryState.Data>';
  assert.match(
    messages(section('<QueryState query={things}>', PENDING, ERROR, other))[0],
    /^3: <QueryState\.Data of=\{others\}> under <QueryState query=\{things\}>/,
  );
});
// oppenheimer:end web
