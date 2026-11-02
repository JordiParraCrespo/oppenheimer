import { describe, expect, it } from 'vitest';
import { exploredLine } from './explored-line';

/**
 * The words after either chat's Explored heading. What breaks this: verbs
 * run together without their separator, a long list drawn whole, or a verb
 * that named nothing drawn with a stray comma.
 */

const words = {
  verb: { read: 'Read', search: 'Searched', list: 'Listed' },
  more: (count: number) => `+${count} more`,
};

describe('exploredLine', () => {
  it('names each verb with its targets, the verbs apart by a middle dot', () => {
    expect(
      exploredLine(
        [
          { verb: 'read', targets: ['a.ts', 'b.ts'] },
          { verb: 'search', targets: ['cancel'] },
        ],
        words,
      ),
    ).toBe('Read a.ts, b.ts · Searched cancel');
  });

  it('cuts a long list to its first three and a count', () => {
    expect(exploredLine([{ verb: 'read', targets: ['a', 'b', 'c', 'd', 'e'] }], words)).toBe(
      'Read a, b, c +2 more',
    );
  });

  it('says only the verb when the calls named nothing', () => {
    expect(exploredLine([{ verb: 'list', targets: [] }], words)).toBe('Listed');
  });
});
