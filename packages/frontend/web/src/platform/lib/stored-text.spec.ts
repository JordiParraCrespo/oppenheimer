import { afterEach, describe, expect, it, vi } from 'vitest';
import { storedTexts } from './stored-text';

/**
 * A half-written text outlives its screen and a reload, and storage that
 * refuses to answer costs the reload, never the text in the tab.
 */

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('storedTexts', () => {
  it('reads back, after a reload, what was written', () => {
    storedTexts('oppenheimer.test.').write('a', 'half a thought');

    // A fresh store is what a reloaded page starts with.
    expect(storedTexts('oppenheimer.test.').read('a')).toBe('half a thought');
  });

  it('forgets an empty text, in storage too', () => {
    const texts = storedTexts('oppenheimer.test.');
    texts.write('a', 'x');
    texts.write('a', '');

    expect(window.localStorage.getItem('oppenheimer.test.a')).toBeNull();
  });

  it('tells subscribers which text changed, and only when it did', () => {
    const texts = storedTexts('oppenheimer.test.');
    const listener = vi.fn();
    texts.subscribe(listener);

    texts.write('a', 'x');
    texts.write('a', 'x');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('a');
  });

  it('keeps the text in memory when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const texts = storedTexts('oppenheimer.test.');
    texts.write('a', 'still here');

    expect(texts.read('a')).toBe('still here');
  });
});
