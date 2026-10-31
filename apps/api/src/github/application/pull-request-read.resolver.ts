import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { CacheService } from '@oppenheimer/backend-cache';
import { GITHUB_PULLS } from '../github.di-tokens';
import type {
  GithubPullRequestFile,
  GithubPullsPort,
  GithubReviewComment,
  GithubTimelineItem,
} from '../infrastructure/github-pulls.port';
import { GithubAccessResolver } from './github-access.resolver';
import type { PullRequestAddress, PullRequestSnapshot } from './pull-request-access.port';
import type { PullRequestReadPort } from './pull-request-read.port';
import {
  OPEN_TTL_SECONDS,
  PullRequestSnapshotResolver,
  snapshotKey,
} from './pull-request-snapshot.resolver';

/**
 * One pull request's screen, read live through the credential
 * {@link GithubAccessResolver} gives for its repository. The snapshot is the
 * one the queue keeps, so opening a pull request from the queue reads nothing
 * but its `updated_at`.
 */
@Injectable()
export class PullRequestReadResolver implements PullRequestReadPort {
  constructor(
    @Inject(GITHUB_PULLS)
    private readonly pulls: GithubPullsPort,
    private readonly cache: CacheService,
    private readonly access: GithubAccessResolver,
    private readonly snapshots: PullRequestSnapshotResolver,
  ) {}

  async pullRequest(scope: AccessScope, address: PullRequestAddress): Promise<PullRequestSnapshot> {
    const repository = await this.access.repositoryOf(scope, address);
    const credential = await this.access.readCredential(scope, address);
    // Read live once to learn `updated_at`, so the snapshot key changes the moment GitHub's answer does.
    const pull = await this.pulls.readPullRequest(credential, repository.fullName, address.number);
    const key = snapshotKey(credential, repository, pull.number, pull.updatedAt, true);
    // One pull request on its own screen draws on no budget: it is the whole
    // of what the reader asked for.
    return (
      (await this.cache.get<PullRequestSnapshot>(key)) ??
      (await this.snapshots.fill(credential, repository, pull.number, pull, key, OPEN_TTL_SECONDS))
    );
  }

  async files(scope: AccessScope, address: PullRequestAddress): Promise<GithubPullRequestFile[]> {
    const repository = await this.access.repositoryOf(scope, address);
    const credential = await this.access.readCredential(scope, address);
    return this.pulls.listFiles(credential, repository.fullName, address.number);
  }

  async reviewComments(
    scope: AccessScope,
    address: PullRequestAddress,
  ): Promise<GithubReviewComment[]> {
    const repository = await this.access.repositoryOf(scope, address);
    const credential = await this.access.readCredential(scope, address);
    return this.pulls.listReviewComments(credential, repository.fullName, address.number);
  }

  async activity(scope: AccessScope, address: PullRequestAddress): Promise<GithubTimelineItem[]> {
    const repository = await this.access.repositoryOf(scope, address);
    const credential = await this.access.readCredential(scope, address);
    return this.pulls.listTimeline(credential, repository.fullName, address.number);
  }
}
