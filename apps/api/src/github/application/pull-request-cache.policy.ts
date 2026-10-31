import { AppError } from '@oppenheimer/backend-core';
import { GithubErrors } from '../domain/github.errors';
import type { GithubCredential, GithubRefusal } from '../infrastructure/github-pulls.port';
import type { WorkspaceRepository } from './pull-request-access.port';

/*
 * Where the Pull requests area's reads of GitHub are cached, for how long,
 * and what a refused read means: the rules the source, the snapshots and the
 * writes that forget a listing all share, so a key is spelled in one place.
 */

/** A repository's open list: short, so a merge or a new push shows on the next look. */
export const OPEN_TTL_SECONDS = 30;
/** A snapshot GitHub answered only in part is kept briefly, so the next read asks again (#244). */
const PARTIAL_TTL_SECONDS = 15;
/**
 * A part GitHub refused with "slow down" is kept far longer than one it simply
 * failed (#247). A secondary rate limit lasts minutes, so asking again fifteen
 * seconds later earns another refusal and nothing else: the gap caches itself
 * out of existence and re-creates itself on every view.
 */
const RATE_LIMITED_TTL_SECONDS = 5 * 60;

/**
 * Whose answers a read may share: the installation, or the one token of a
 * person's that made it (§6.2). Never another's: two tokens of one GitHub
 * account share a budget, not what they can see.
 */
function cacheScopeOf(credential: GithubCredential): string {
  return credential.cacheScope ?? credential.bucket;
}

/**
 * Where a repository's open pull requests are kept: the one GraphQL read, and
 * the REST listing it falls back to. A write forgets both.
 */
export function openListingKeys(
  credential: GithubCredential,
  repository: WorkspaceRepository,
): { graph: string; rest: string } {
  const at = `${cacheScopeOf(credential)}:${repository.githubRepoId}`;
  return { graph: `github:pulls:open-graph:${at}`, rest: `github:pulls:open:${at}` };
}

/** Where a repository's newest page of pull requests in a state is kept. */
export function listingKey(
  credential: GithubCredential,
  repository: WorkspaceRepository,
  state: 'open' | 'closed',
): string {
  return `github:pulls:${state}:${cacheScopeOf(credential)}:${repository.githubRepoId}`;
}

/**
 * A snapshot's cache key, under the credential's cache scope: what GitHub
 * answers one installation, or one token (§6.2), is never served to a read
 * made with another. `withChecks` is part of it because a read that left
 * the checks out must not be found by one that needs them: storing both under
 * one key meant opening a closed pull request within the six-hour window
 * reported its checks as unavailable.
 */
export function snapshotKey(
  credential: GithubCredential,
  repository: WorkspaceRepository,
  number: number,
  updatedAt: string,
  withChecks: boolean,
): string {
  const parts = `${cacheScopeOf(credential)}:${repository.githubRepoId}:${number}:${updatedAt}`;
  return withChecks ? `github:pulls:snapshot:${parts}` : `github:pulls:snapshot:nochecks:${parts}`;
}

/**
 * How long a snapshot is kept. A part refused for a rate limit is held until
 * the limit has had time to lift, so the next poll does not earn the refusal
 * again; any other refused part is held briefly so the next read asks again.
 */
export function ttlFor(refusals: (GithubRefusal | null)[], whole: number): number {
  if (refusals.includes('rate_limited')) return RATE_LIMITED_TTL_SECONDS;
  return refusals.some(Boolean) ? PARTIAL_TTL_SECONDS : whole;
}

/** What a failed read means to a reader: no access, gone, wait, or GitHub did not answer. */
export function refusalOf(error: unknown): GithubRefusal {
  if (!(error instanceof AppError)) return 'failed';
  if (error.code === GithubErrors.RATE_LIMITED.code) return 'rate_limited';
  if (
    error.code === GithubErrors.INSTALLATION_SUSPENDED.code ||
    error.code === GithubErrors.INSTALLATION_NOT_FOUND.code
  ) {
    return 'forbidden';
  }
  const status = error.extensions.upstreamStatus;
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 404 || error.code === GithubErrors.PULL_REQUEST_NOT_FOUND.code) return 'not_found';
  return 'failed';
}
