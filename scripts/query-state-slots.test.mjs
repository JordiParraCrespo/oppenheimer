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
const DATA = '<QueryState.Data><ThingRows /></QueryState.Data>';

const section = (...slots) => `export function ThingList() {
  return (
    <QueryState>
      ${slots.join('\n      ')}
    </QueryState>
  );
}
`;
const messages = (source) =>
  queryStateSlotProblems(source).map(({ line, message }) => `${line}: ${message}`);

test('Pending, Error and Data pass', () => {
  assert.deepEqual(messages(section(PENDING, ERROR, DATA)), []);
});

test('a missing rung is reported on the root line, naming each slot', () => {
  const [problem] = messages(section(PENDING));
  assert.match(problem, /^3: <QueryState> without QueryState\.Error, QueryState\.Data —/);
});

test('a comment does not count as a slot', () => {
  const source = section(PENDING, '{/* <QueryState.Error fallback="x" /> */}', DATA);
  assert.match(messages(source)[0], /without QueryState\.Error —/);
});

test('two roots in one file are each checked on their own line', () => {
  const source = `${section(PENDING, ERROR, DATA)}${section(PENDING, DATA)}`;
  assert.deepEqual(
    queryStateSlotProblems(source).map(({ line }) => line),
    [12],
  );
});

test("a nested root's slots do not count for the root around it", () => {
  const inner = `<QueryState>${PENDING}${ERROR}${DATA}</QueryState>`;
  const source = section(PENDING, `<QueryState.Data>${inner}</QueryState.Data>`);
  const reported = messages(source);
  assert.equal(reported.length, 1);
  assert.match(reported[0], /^3: <QueryState> without QueryState\.Error —/);
});
// oppenheimer:end web
