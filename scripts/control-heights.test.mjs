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
  const none = new Map();
  assert.deepEqual(check(one, new Map([['a.tsx', 1]]), none), []);
  assert.equal(check(one, new Map(), none).length, 1);
  assert.match(
    check(new Map(), new Map([['a.tsx', 1]]), none)[0],
    /lower its count in CONTROL_HEIGHT_DEBT \(/,
  );
});

test('what is not a control is held to its count like the debt, and adds to it', () => {
  const two = new Map([
    [
      'a.tsx',
      [
        { line: 1, token: 'h-8' },
        { line: 2, token: 'h-12' },
      ],
    ],
  ]);
  const row = new Map([['a.tsx', { count: 1, why: 'a list row' }]]);
  assert.deepEqual(check(two, new Map([['a.tsx', 1]]), row), []);
  assert.equal(check(two, new Map(), row).length, 1);
  assert.match(check(new Map(), new Map(), row)[0], /lower its count in NOT_A_CONTROL \(/);
  assert.match(
    check(new Map(), new Map([['a.tsx', 1]]), row)[0],
    /lower its count in CONTROL_HEIGHT_DEBT or NOT_A_CONTROL/,
  );
});

test('a bare Button, Input, Select, Toggle or Tab is a control by its tag', () => {
  for (const tag of ['Button', 'Input', 'Select', 'Toggle', 'Tab']) {
    assert.deepEqual(tokens(`<${tag} size="sm" className="h-9" />`), ['h-9'], tag);
  }
});

test('a class list with a substitution is read on both sides of it', () => {
  const at = (source) => tokens(source);
  assert.deepEqual(at('const a = `inline-flex h-8 ${x} focus-visible:ring-2`;'), ['h-8']);
  assert.deepEqual(at('const a = `${x} focus-visible:ring-2 h-8`;'), ['h-8']);
  assert.deepEqual(at('const a = `${x} h-8 ${y} focus-visible:ring-2`;'), ['h-8']);
});

test('an important height is still a hand-written one', () => {
  assert.deepEqual(tokens(`const a = '!h-8 focus-visible:ring-2';`), ['!h-8']);
  assert.deepEqual(tokens(`const a = 'md:!h-8 focus-visible:ring-2';`), ['md:!h-8']);
  assert.deepEqual(tokens(`const a = 'h-8! focus-visible:ring-2';`), ['h-8!']);
});

test('a string beside a control only by distance is not the control’s', () => {
  const source = `const ring = 'focus-visible:ring-2';\nconst row = 'flex h-11 items-center';`;
  assert.deepEqual(tokens(source), []);
  assert.deepEqual(
    tokens(
      `<div className="flex h-8 items-center"><button className="focus-visible:ring-2" /></div>`,
    ),
    [],
  );
});

test('a variant map is one control however far its sizes sit from its focus ring', () => {
  const pad = 'x'.repeat(2000);
  const source = `const v = cva('inline-flex focus-visible:ring-2 ${pad}', { variants: { size: { xs: 'h-6 px-2' } } });`;
  assert.deepEqual(tokens(source), ['h-6']);
});
