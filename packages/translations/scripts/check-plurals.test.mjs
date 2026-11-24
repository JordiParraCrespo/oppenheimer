/**
 * A Spanish counted key without `_many` shows its raw key at a million:
 * i18next asks for `_many` there and does not fall back to `_other`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pluralGaps } from './check-plurals.mjs';

test('a Spanish counted key without _many is a gap; English needs only _one and _other', () => {
  const catalog = { lines: { showAll_one: 'una', showAll_other: '{{count}}' } };
  assert.deepEqual(pluralGaps('es', catalog), [{ key: 'lines.showAll', missing: ['many'] }]);
  assert.deepEqual(pluralGaps('en', catalog), []);
});

test('every form present is no gap, and _zero is never required', () => {
  const catalog = { n_zero: 'ninguna', n_one: 'una', n_many: '{{count}}', n_other: '{{count}}' };
  assert.deepEqual(pluralGaps('es', catalog), []);
  assert.deepEqual(pluralGaps('es', { n_one: 'una', n_many: 'm', n_other: 'o' }), []);
});

test('a key that only ends in a category-like word, or is ordinal, is not counted', () => {
  assert.deepEqual(pluralGaps('es', { other: 'otro', mother: 'madre' }), []);
  assert.deepEqual(pluralGaps('es', { place_ordinal_one: '1.º', place_ordinal_other: 'n.º' }), []);
});

test('a key with only _other still owes the other forms', () => {
  assert.deepEqual(pluralGaps('es', { n_other: 'o' }), [{ key: 'n', missing: ['one', 'many'] }]);
});
