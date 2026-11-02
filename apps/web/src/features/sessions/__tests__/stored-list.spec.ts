import { afterEach, describe, expect, it } from 'vitest';
import { rememberList, storedList } from '../lib/stored-list';

/**
 * What the sidebar keeps on this device (pins, folds) reads back as written,
 * and anything unreadable in storage is an empty list rather than a crash.
 */

const KEY = 'oppenheimer.test.list';

afterEach(() => window.localStorage.clear());

describe('storedList', () => {
  it('reads back what was remembered', () => {
    rememberList(KEY, ['a', 'b']);
    expect(storedList(KEY)).toEqual(['a', 'b']);
  });

  it.each([
    ['nothing stored', null, []],
    ['broken JSON', '{not json', []],
    ['a string', '"a"', []],
    ['non-strings and repeats', '[1,"a","a"]', ['a']],
  ])('reads %s as what it can make of it', (_, raw, expected) => {
    if (raw !== null) window.localStorage.setItem(KEY, raw);
    expect(storedList(KEY)).toEqual(expected);
  });
});
