import type { PullRequestEntity, ReviewVerdict } from '@oppenheimer/frontend-consumer';

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
