import { describe, expect, it } from 'vitest';
import { cardClickPick, NO_CARD_SELECTION, pickCard } from '../lib/card-selection';

const order = ['a', 'b', 'c', 'd', 'e'];

describe('pickCard', () => {
  it('toggles one card in and out, and leaves selection when the last one goes', () => {
    const one = pickCard(NO_CARD_SELECTION, 'b', 'toggle', order);
    expect(one).toEqual({ ids: ['b'], anchor: 'b' });
    expect(pickCard(one, 'b', 'toggle', order)).toBe(NO_CARD_SELECTION);
  });

  it('takes every card between the anchor and a Shift-click, across columns, adding to the picked', () => {
    const start = pickCard(pickCard(NO_CARD_SELECTION, 'e', 'toggle', order), 'b', 'toggle', order);
    expect(pickCard(start, 'd', 'range', order)).toEqual({
      ids: ['e', 'b', 'c', 'd'],
      anchor: 'b',
    });
  });

  it('reads a Shift-click with no anchor on the board as a toggle', () => {
    expect(pickCard(NO_CARD_SELECTION, 'c', 'range', order)).toEqual({ ids: ['c'], anchor: 'c' });
  });
});

describe('cardClickPick', () => {
  const plain = { shiftKey: false, metaKey: false, ctrlKey: false };

  it('opens the task on a plain click until something is picked, then toggles', () => {
    expect(cardClickPick(plain, false)).toBeNull();
    expect(cardClickPick(plain, true)).toBe('toggle');
  });

  it('picks on ⌘, Ctrl and Shift clicks', () => {
    expect(cardClickPick({ ...plain, metaKey: true }, false)).toBe('toggle');
    expect(cardClickPick({ ...plain, ctrlKey: true }, false)).toBe('toggle');
    expect(cardClickPick({ ...plain, shiftKey: true }, false)).toBe('range');
  });
});
