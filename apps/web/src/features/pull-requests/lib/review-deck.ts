import type { PullRequestEntity, ReviewVerdict } from '@oppenheimer/frontend-consumer';
import { searchText } from '@oppenheimer/frontend-web';
import type { z } from 'zod';
import { queueSearchSchema } from './queue-search';

/**
 * The review deck's address: the queue's scope, repository and facets, which
 * pick the pull requests it walks, and `at`, the one on screen. It is a link:
 * leaving for a pull request's changes and coming Back lands on the same card.
 */
export const reviewSearchSchema = queueSearchSchema.extend({ at: searchText });
export type ReviewSearch = z.infer<typeof reviewSearchSchema>;

/** `at` once the last card has been passed. */
export const DECK_END = 'end';

/** How the deck names a card in its address: the repository's id and the number. */
export function deckKey(pull: Pick<PullRequestEntity, 'githubRepoId' | 'number'>): string {
  return `${pull.githubRepoId}-${pull.number}`;
}

export interface DeckPosition<T> {
  /** The card on screen; null once the deck is done, when it is empty, or when {@link gone}. */
  current: T | null;
  /** The card after it, which a pass or an action moves to. */
  next: T | null;
  /** How many cards came before the one on screen. */
  index: number;
  /**
   * The address names a card that is not in the deck: it merged, here a
   * moment ago or on GitHub. The deck shows no card rather than another one
   * under the same action bar, where a key meant for the card that left
   * would land on a pull request the reader was not looking at.
   */
  gone: boolean;
}

/** Where the deck stands; no address is the first card. */
export function deckPosition<T extends Pick<PullRequestEntity, 'githubRepoId' | 'number'>>(
  rows: readonly T[],
  at: string | undefined,
): DeckPosition<T> {
  if (at === DECK_END) return { current: null, next: null, index: rows.length, gone: false };
  const found = at === undefined ? 0 : rows.findIndex((row) => deckKey(row) === at);
  if (found < 0) return { current: null, next: null, index: 0, gone: true };
  return {
    current: rows[found] ?? null,
    next: rows[found + 1] ?? null,
    index: found,
    gone: false,
  };
}

/** What a press on a card does: a merge in the reader's name, or a review with that verdict. */
export type DeckVerb = 'merge' | ReviewVerdict;

/**
 * What a card's three presses do, decided once from whose pull request it is.
 * Yours and your sessions' are merged, and GitHub takes no verdict on them,
 * so their words are a comment; anybody else's is approved, approved and
 * merged, or sent back.
 */
export function deckVerbs(scope: PullRequestEntity['scope']): {
  /** `→`: the card's yes. */
  yes: DeckVerb;
  /** `M`, and `→` when the yes is the merge: armed by one press, made by the next. */
  merges: DeckVerb;
  /** `C`: what the reader's words are sent as. */
  says: ReviewVerdict;
} {
  return scope === 'mine'
    ? { yes: 'merge', merges: 'merge', says: 'comment' }
    : { yes: 'approve', merges: 'approve_and_merge', says: 'request_changes' };
}

/** The copy each verb is labelled with. */
export const DECK_VERB_LABEL = {
  merge: 'pullRequests.queue.mergeButton.merge',
  approve: 'pullRequests.review.verdicts.approve.label',
  approve_and_merge: 'pullRequests.review.verdicts.approve_and_merge.label',
  comment: 'pullRequests.review.verdicts.comment.label',
  request_changes: 'pullRequests.review.verdicts.request_changes.label',
} as const satisfies Record<DeckVerb, string>;
