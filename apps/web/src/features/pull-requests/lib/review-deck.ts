import type { PullRequestEntity } from '@oppenheimer/frontend-consumer';
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
  /** The card on screen; null once the deck is done, or when it is empty. */
  current: T | null;
  /** The card after it, which a pass or an action moves to. */
  next: T | null;
  /** How many cards came before the one on screen. */
  index: number;
}

/**
 * Where the deck stands. An address that names no card of the deck (none yet,
 * or one that merged and left the queue) starts at the first: the deck never
 * shows an empty frame for a pull request that is gone.
 */
export function deckPosition<T extends Pick<PullRequestEntity, 'githubRepoId' | 'number'>>(
  rows: readonly T[],
  at: string | undefined,
): DeckPosition<T> {
  if (at === DECK_END) return { current: null, next: null, index: rows.length };
  const found = rows.findIndex((row) => deckKey(row) === at);
  const index = found < 0 ? 0 : found;
  return { current: rows[index] ?? null, next: rows[index + 1] ?? null, index };
}
