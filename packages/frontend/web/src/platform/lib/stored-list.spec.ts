import { afterEach, describe, expect, it } from 'vitest';
import { rememberList, storedList, storedLists, withFold, withListedFirst } from './stored-list';

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

describe('withListedFirst', () => {
  it('moves an id added again to the top rather than listing it twice', () => {
    expect(withListedFirst(['a', 'b'], 'b', true)).toEqual(['b', 'a']);
    expect(withListedFirst(['a', 'b'], 'a', false)).toEqual(['b']);
  });
});

describe('withFold', () => {
  it('folds a key once however often it is folded, and opens it again', () => {
    expect(withFold(withFold(['a'], 'a', false), 'a', false)).toEqual(['a']);
    expect(withFold(['a', 'b'], 'a', true)).toEqual(['b']);
  });
});

/**
 * The store without React: a write reaches a subscriber of its key and no
 * other, and another tab's write is read back. What breaks this: a stale
 * snapshot after a storage event, or a write that wakes every key.
 */
describe('storedLists', () => {
  it('tells the subscribers of the key written, and reads another tab’s write', () => {
    const woken: string[] = [];
    const offA = storedLists.subscribe('lists.a', () => woken.push('a'));
    const offB = storedLists.subscribe('lists.b', () => woken.push('b'));

    storedLists.write('lists.a', (current) => [...current, 'x']);
    expect(storedLists.read('lists.a')).toEqual(['x']);
    expect(woken).toEqual(['a']);

    window.localStorage.setItem('lists.b', JSON.stringify(['y']));
    window.dispatchEvent(new StorageEvent('storage', { key: 'lists.b' }));
    expect(woken).toEqual(['a', 'b']);
    expect(storedLists.read('lists.b')).toEqual(['y']);

    offA();
    offB();
  });
});
