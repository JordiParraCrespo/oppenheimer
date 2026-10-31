import { Inject, Injectable, Logger } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import type { AccessScope } from '../../authz/domain/access-scope.types';
import { GITHUB_PULLS } from '../github.di-tokens';
import type {
  GithubCredential,
  GithubOpenPullRequest,
  GithubPart,
  GithubPullRequestDetail,
  GithubPullRequestSummary,
  GithubPullsPort,
  GithubRefusal,
} from '../infrastructure/github-pulls.port';
import { GithubAccessResolver } from './github-access.resolver';
import type { Part, PullRequestSnapshot, WorkspaceRepository } from './pull-request-access.port';
import {
  listingKey,
  OPEN_TTL_SECONDS,
  openListingKeys,
  refusalOf,
} from './pull-request-cache.policy';

/** A read GitHub refused, with the refusal it gave. */
export type Refused = { ok: false; refusal: GithubRefusal };

/**
 * A repository's open pull requests as far as one read answers them: the ones
 * it gave whole, the ones still to fill, and the detail already read for each
 * of those where there is one.
 */
export interface OpenPullRequestsRead {
  ok: true;
  credential: GithubCredential;
  whole: PullRequestSnapshot[];
  unfilled: GithubPullRequestSummary[];
  known: Map<number, GithubPullRequestDetail>;
}

/**
 * Where a repository's pull requests come from before anything is filled: the
 * one GraphQL read of the open ones, the REST listing it falls back to, and
 * the REST listing the closed ones always come from. Each answer is cached
 * briefly as GitHub gave it, under the credential's cache scope.
 */
@Injectable()
export class PullRequestSourceResolver {
  private readonly logger = new Logger(PullRequestSourceResolver.name);

  constructor(
    @Inject(GITHUB_PULLS)
    private readonly pulls: GithubPullsPort,
    private readonly cache: CacheService,
    private readonly access: GithubAccessResolver,
  ) {}

  /**
   * The GraphQL read is the source; one it fails for any reason but a rate
   * limit falls back to the REST listing, which leaves every pull request to
   * fill. A rate limit is GitHub saying "not now": asking REST instead would
   * spend the same budget on the same refusal.
   */
  async open(
    scope: AccessScope,
    repository: WorkspaceRepository,
  ): Promise<OpenPullRequestsRead | Refused> {
    let credential: GithubCredential;
    try {
      credential = await this.access.readCredential(scope, repository);
    } catch (error) {
      return { ok: false, refusal: refusalOf(error) };
    }
    try {
      const read = await this.cache.getOrSet(
        openListingKeys(credential, repository).graph,
        OPEN_TTL_SECONDS,
        () => this.pulls.listOpenPullRequests(credential, repository.fullName),
      );
      const whole: PullRequestSnapshot[] = [];
      const known = new Map<number, GithubPullRequestDetail>();
      for (const entry of read) {
        const snapshot = wholeSnapshot(repository, entry);
        if (snapshot) whole.push(snapshot);
        else known.set(entry.pull.number, entry.pull);
      }
      return { ok: true, credential, whole, unfilled: [...known.values()], known };
    } catch (error) {
      const refusal = refusalOf(error);
      if (refusal === 'rate_limited') return { ok: false, refusal };
      // Logged, because a fallback that answers is otherwise invisible: a
      // GraphQL answer this module misreads would quietly cost the old fan-out.
      this.logger.warn(
        {
          message: 'The open pull requests read fell back to REST',
          repository: repository.fullName,
          refusal,
        },
        error instanceof Error ? error.stack : String(error),
      );
      // With the credential already resolved: asking for it again is a second
      // lookup the fallback does not need.
      const listing = await this.listWith(credential, repository, 'open', OPEN_TTL_SECONDS);
      if (!listing.ok) return listing;
      return { ok: true, credential, whole: [], unfilled: listing.pulls, known: new Map() };
    }
  }

  /** One repository's newest page of pull requests in a state, or the refusal GitHub gave. */
  async listing(
    scope: AccessScope,
    repository: WorkspaceRepository,
    state: 'open' | 'closed',
    ttlSeconds: number,
  ): Promise<
    { ok: true; credential: GithubCredential; pulls: GithubPullRequestSummary[] } | Refused
  > {
    let credential: GithubCredential;
    try {
      credential = await this.access.readCredential(scope, repository);
    } catch (error) {
      return { ok: false, refusal: refusalOf(error) };
    }
    const listing = await this.listWith(credential, repository, state, ttlSeconds);
    return listing.ok ? { ok: true, credential, pulls: listing.pulls } : listing;
  }

  /** The same with a credential already resolved for the repository. */
  private async listWith(
    credential: GithubCredential,
    repository: WorkspaceRepository,
    state: 'open' | 'closed',
    ttlSeconds: number,
  ): Promise<{ ok: true; pulls: GithubPullRequestSummary[] } | Refused> {
    try {
      const pulls = await this.cache.getOrSet(
        listingKey(credential, repository, state),
        ttlSeconds,
        () => this.pulls.listPullRequests(credential, repository.fullName, state, 1),
      );
      return { ok: true, pulls };
    } catch (error) {
      return { ok: false, refusal: refusalOf(error) };
    }
  }
}

/**
 * A pull request the one read answered whole, or null when a part ran past
 * its page: a part cut short is never shown as all of it (#244).
 */
function wholeSnapshot(
  repository: WorkspaceRepository,
  entry: GithubOpenPullRequest,
): PullRequestSnapshot | null {
  const files = settled(entry.files);
  const checks = settled(entry.checks);
  const reviews = settled(entry.reviews);
  if (!files || !checks || !reviews) return null;
  return { repository, pull: entry.pull, files, checks, reviews };
}

function settled<T>(part: GithubPart<T>): Part<T> | null {
  return part.refusal === 'past_page' ? null : part;
}
