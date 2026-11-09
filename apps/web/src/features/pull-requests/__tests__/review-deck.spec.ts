import { describe, expect, it } from 'vitest';
import { DECK_END, deckKey, deckPosition } from '../lib/review-deck';

const rows = [
  { githubRepoId: 1, number: 12 },
  { githubRepoId: 1, number: 14 },
  { githubRepoId: 2, number: 33 },
];

describe('the review deck’s position', () => {
  it('starts at the first card, with the second one next', () => {
    expect(deckPosition(rows, undefined)).toEqual({ current: rows[0], next: rows[1], index: 0 });
  });

  it('stands on the card its address names', () => {
    expect(deckPosition(rows, deckKey(rows[2]))).toEqual({
      current: rows[2],
      next: null,
      index: 2,
    });
  });

  it('starts over when the card it named has left the queue, rather than showing nothing', () => {
    expect(deckPosition(rows, '9-99').current).toBe(rows[0]);
  });

  it('is done past the last card, and has no card when the queue is empty', () => {
    expect(deckPosition(rows, DECK_END)).toEqual({ current: null, next: null, index: 3 });
    expect(deckPosition([], undefined)).toEqual({ current: null, next: null, index: 0 });
  });
});
