import { describe, expect, it } from 'vitest';
import {
  cardClickPick,
  marqueeBox,
  marqueePick,
  NO_CARD_SELECTION,
  pickCard,
} from '../lib/card-selection';

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

describe('marqueePick', () => {
  const cards = [
    { id: 'a', box: { left: 0, top: 0, width: 100, height: 50 } },
    { id: 'b', box: { left: 0, top: 60, width: 100, height: 50 } },
    { id: 'c', box: { left: 120, top: 0, width: 100, height: 50 } },
  ];

  it('picks every card the rectangle touches, drawn either way round, and none it misses', () => {
    const box = marqueeBox({ x: 90, y: 100 }, { x: 10, y: 40 });
    expect(marqueePick(box, cards, [])).toEqual(['a', 'b']);
  });

  it('keeps what an additive drag started with, once each', () => {
    const box = marqueeBox({ x: 130, y: 10 }, { x: 140, y: 20 });
    expect(marqueePick(box, cards, ['b', 'c'])).toEqual(['b', 'c']);
  });
});
