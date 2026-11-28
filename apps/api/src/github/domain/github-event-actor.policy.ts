/**
 * Whether an author is part of the repository, from GitHub's
 * `author_association`: its owner, a member of its organization or a
 * collaborator. Anyone else (a contributor, a first-timer, nobody) wrote
 * from outside it; null when GitHub did not say.
 */
export function isRepositoryInsider(association: string | null | undefined): boolean | null {
  if (!association) return null;
  return ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(association.toUpperCase());
}

const WRITERS_ONLY = new Set(['push', 'pr_merged', 'release']);

const AUTHORED = new Set([
  'issue_opened',
  'comment',
  'mention',
  'review',
  'pr_opened',
  'pr_draft',
  'pr_sync',
]);

const CHECKS = new Set(['check_failed', 'check_passed']);

/** Who added a label, as the normalizer tells it: the item's author, an app, or another person. */
export type GithubLabeler = 'author' | 'app' | 'person';

/**
 * Whether a stored GitHub event was caused by someone inside its repository,
 * which is what lets it start a run or wake a follower. On a public
 * repository anyone can open an issue, comment or review, and what they write
 * would reach an agent on the owner's machine; so an event a stranger can
 * cause starts nothing unless GitHub says its author is the repository's
 * owner, a member of its organization or a collaborator. Pure: a decision
 * table over the event's type and the attributes the normalizer stored.
 *
 * | Event                                              | Inside when                                              |
 * |----------------------------------------------------|----------------------------------------------------------|
 * | `push`, `pr_merged`, `release`                     | always: GitHub lets only writers push, merge or publish  |
 * | `issue_opened`, `comment`, `mention`, `review`, `pr_opened`, `pr_draft`, `pr_sync` | the author's `author_association` is an insider's |
 * | `issue_labeled`                                    | a person other than the author added it (that takes triage access), or the author is an insider |
 * | `check_failed`, `check_passed`                     | the commit is on a branch of the repository: a fork's commit has none (`check_suite.head_branch` is null, a status's `branches` empty) |
 * | anything else                                      | never                                                    |
 *
 * It fails closed: an event a stranger could cause that carries no
 * association (one stored before the normalizer kept it, or a payload
 * without one) is an outsider's.
 */
export function githubEventByInsider(
  eventType: string,
  attributes: Readonly<Record<string, unknown>> | undefined,
): boolean {
  const authorInside = () =>
    isRepositoryInsider(
      typeof attributes?.authorAssociation === 'string' ? attributes.authorAssociation : null,
    ) === true;
  if (WRITERS_ONLY.has(eventType)) return true;
  if (AUTHORED.has(eventType)) return authorInside();
  if (eventType === 'issue_labeled') return attributes?.labeledBy === 'person' || authorInside();
  if (CHECKS.has(eventType)) {
    return typeof attributes?.branch === 'string' && attributes.branch.length > 0;
  }
  return false;
}
