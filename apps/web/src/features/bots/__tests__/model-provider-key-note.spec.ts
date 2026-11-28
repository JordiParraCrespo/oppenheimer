// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { modelProviderKeyNotes } from '../lib/model-provider-key-note';

/**
 * Which note each of a provider's key rows shows. What breaks this: a spent
 * key still reads "Used now" while calls run on the next, or the key calls
 * run on reads as a fallback.
 */
describe('modelProviderKeyNotes', () => {
  it('says the first key not spent is the one in use, and the spent ones are out of credit', () => {
    const notes = modelProviderKeyNotes([
      { id: 'a', spentAt: new Date('2026-11-20') },
      { id: 'b', spentAt: null },
      { id: 'c', spentAt: null },
    ]);
    expect([...notes.entries()]).toEqual([
      ['a', 'keySpentNote'],
      ['b', 'keyFirst'],
      ['c', 'keyNext'],
    ]);
  });

  it('has none in use when every key is spent', () => {
    const notes = modelProviderKeyNotes([{ id: 'a', spentAt: new Date('2026-11-20') }]);
    expect(notes.get('a')).toBe('keySpentNote');
  });
});
