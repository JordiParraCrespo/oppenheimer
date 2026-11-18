import { describe, expect, it } from 'vitest';
import { deckVerbs } from '../lib/deck-verbs';
import { DECK_END, deckKey, deckPosition } from '../lib/review-deck';

const rows = [
  { githubRepoId: 1, number: 12 },
  { githubRepoId: 1, number: 14 },
  { githubRepoId: 2, number: 33 },
];

describe('the review deck’s position', () => {
  it('starts at the first card, with the second one next', () => {
    expect(deckPosition(rows, undefined)).toEqual({
      current: rows[0],
      previous: null,
      next: rows[1],
      index: 0,
      gone: false,
    });
  });

  it('stands on the card its address names', () => {
    expect(deckPosition(rows, deckKey(rows[2]))).toEqual({
      current: rows[2],
      previous: rows[1],
      next: null,
      index: 2,
      gone: false,
    });
  });

  it('shows no card when the one it named has left the queue, never another under the same actions', () => {
    expect(deckPosition(rows, '9-99')).toEqual({
      current: null,
      previous: null,
      next: null,
      index: 0,
      gone: true,
    });
  });

  it('is done past the last card, with the last one a step back, and has no card when the queue is empty', () => {
    expect(deckPosition(rows, DECK_END)).toMatchObject({
      current: null,
      previous: rows[2],
      index: 3,
      gone: false,
    });
    expect(deckPosition([], undefined)).toMatchObject({ current: null, index: 0, gone: false });
  });
});

describe('what a card’s presses do', () => {
  it('merges yours, with no verdict GitHub would refuse on your own pull request', () => {
    expect(deckVerbs('mine')).toEqual({ yes: 'merge', merges: 'merge', says: 'comment' });
  });

  it('approves anybody else’s, and never merges it on the one-press yes', () => {
    for (const scope of ['requested', 'watching'] as const) {
      expect(deckVerbs(scope)).toEqual({
        yes: 'approve',
        merges: 'approve_and_merge',
        says: 'request_changes',
      });
    }
  });
});
