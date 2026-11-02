/**
 * Which key reads a repository the App is not installed on
 * (`product/next-steps/0.2-pull-requests.md` §6.2). The App comes first, and
 * the caller only asks this for a repository no installation covers. Among the
 * person's tokens that open it and GitHub still accepts:
 *
 * 1. the token they pinned to the repository;
 * 2. otherwise the narrowest, the one that opens the fewest repositories;
 * 3. on a tie, the most recently added.
 *
 * The choice is made on every read and never stored, so adding, pinning or
 * removing a token never breaks a link or a watch.
 */
export interface TokenCandidate {
  id: string;
  /** GitHub's ids of what the token opened when it was last checked. */
  repositoryIds: readonly number[];
  createdAt: Date;
  expiresAt: Date | null;
  refusedAt: Date | null;
}

/** A token GitHub still accepts: not refused since its last good check, and not past its expiry. */
export function isUsable(token: TokenCandidate, now: Date): boolean {
  if (token.refusedAt) return false;
  return token.expiresAt === null || token.expiresAt.getTime() > now.getTime();
}

/** The token that reads the repository, or null when no usable token opens it. */
export function chooseToken(
  githubRepoId: number,
  tokens: readonly TokenCandidate[],
  pinnedTokenId: string | null,
  now: Date,
): TokenCandidate | null {
  const candidates = tokens.filter(
    (token) => isUsable(token, now) && token.repositoryIds.includes(githubRepoId),
  );
  const pinned = candidates.find((token) => token.id === pinnedTokenId);
  if (pinned) return pinned;
  return (
    [...candidates].sort(
      (a, b) =>
        a.repositoryIds.length - b.repositoryIds.length ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    )[0] ?? null
  );
}
