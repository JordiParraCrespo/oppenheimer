import assert from 'node:assert/strict';
import { test } from 'node:test';
import { check, findings } from './control-heights.mjs';

const tokens = (source) => findings(source).map(({ token }) => token);

test('a control with a hand-written height is found; the ramp token is not', () => {
  assert.deepEqual(tokens(`const a = 'inline-flex h-7.5 rounded-pill focus-visible:ring-2';`), [
    'h-7.5',
  ]);
  assert.deepEqual(
    tokens(`const a = 'inline-flex h-(--control-h-sm) rounded-pill focus-visible:ring-2';`),
    [],
  );
});

test('a height split from the focus ring by a variant map still belongs to the control', () => {
  const source = `cn('rounded-pill focus-visible:ring-2', 'group-data-[size=md]/tabs:h-8 px-3.5')`;
  assert.deepEqual(tokens(source), ['group-data-[size=md]/tabs:h-8']);
});

test('the className of a button is a control, whatever its classes say', () => {
  assert.deepEqual(tokens(`<IconButton onClick={() => go()} className="size-8" />`), ['size-8']);
  assert.deepEqual(tokens(`<button type="button" className="flex h-[30px] items-center">`), [
    'h-[30px]',
  ]);
});

test('a glyph, a dot or a panel is not a control box, and neither is a plain row', () => {
  assert.deepEqual(tokens(`const a = 'h-8 focus-visible:ring-2 [&_svg]:size-4';`), ['h-8']);
  assert.deepEqual(tokens(`const a = 'size-1.5 rounded-pill focus-visible:ring-2';`), []);
  assert.deepEqual(tokens(`const a = 'min-h-80 focus-visible:ring-2';`), []);
  assert.deepEqual(tokens(`<div className="flex h-11 items-center">`), []);
});

test('an apostrophe in a comment does not pair with a class string', () => {
  const source = `// the bot's row\nconst a = 'h-8 focus-visible:ring-2';`;
  assert.deepEqual(tokens(source), ['h-8']);
});

test('the debt holds each file to its count: up fails, down fails until lowered', () => {
  const one = new Map([['a.tsx', [{ line: 1, token: 'h-8' }]]]);
  assert.deepEqual(check(one, new Map([['a.tsx', 1]])), []);
  assert.equal(check(one, new Map()).length, 1);
  assert.match(check(new Map(), new Map([['a.tsx', 1]]))[0], /lower its count/);
});
