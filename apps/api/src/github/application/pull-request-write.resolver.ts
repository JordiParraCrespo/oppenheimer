import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import { GithubErrors } from '../domain/github.errors';
import { isInstallationAddress } from '../domain/repository-address.policy';
import { GITHUB_PULLS } from '../github.di-tokens';
import type { GithubCredential, GithubPullsPort } from '../infrastructure/github-pulls.port';
import { GithubAccessResolver } from './github-access.resolver';
import type {
  InstallationAddress,
  InstallationPullRequestAddress,
  RepositoryAddress,
  ReviewSubmission,
  WorkspaceRepository,
} from './pull-request-access.port';
import { openListingKeys } from './pull-request-snapshot.resolver';
import type { PullRequestWritePort } from './pull-request-write.port';

/**
 * Writes through the caller's own user token, on the head commit read just
 * before through the installation; a write that changes what the queue shows
 * forgets the repository's cached open listing, so the next look reads it
 * afresh. Both credentials come from {@link GithubAccessResolver}.
 */
@Injectable()
export class PullRequestWriteResolver implements PullRequestWritePort {
  constructor(
    @Inject(GITHUB_PULLS)
    private readonly pulls: GithubPullsPort,
    private readonly cache: CacheService,
    private readonly access: GithubAccessResolver,
  ) {}

  requireApp<T extends RepositoryAddress>(address: T): Extract<T, InstallationAddress> {
    if (isInstallationAddress(address)) return address;
    throw new AppError(GithubErrors.READ_ONLY_REPOSITORY, {
      detail: `Repository ${address.githubRepoId} is read through your own GitHub token.`,
    });
  }

  async submitReview(
    scope: AccessScope,
    userId: string,
    address: InstallationPullRequestAddress,
    review: ReviewSubmission,
  ): Promise<void> {
    const { repository, writer, reader, head } = await this.forWrite(scope, userId, address);
    await this.pulls.createReview(writer, repository.fullName, address.number, {
      ...review,
      commitId: head,
    });
    await this.forget(reader, repository);
  }

  async addComment(
    scope: AccessScope,
    userId: string,
    address: InstallationPullRequestAddress,
    comment: { path: string; line: number; side: 'LEFT' | 'RIGHT'; body: string },
  ): Promise<void> {
    const { repository, writer, head } = await this.forWrite(scope, userId, address);
    await this.pulls.createReviewComment(writer, repository.fullName, address.number, {
      ...comment,
      commitId: head,
    });
  }

  async merge(
    scope: AccessScope,
    userId: string,
    address: InstallationPullRequestAddress,
    method: 'squash' | 'merge' | 'rebase',
    expectedHead?: string,
  ): Promise<void> {
    const { repository, writer, reader, head } = await this.forWrite(scope, userId, address);
    if (expectedHead && expectedHead !== head) {
      throw new AppError(GithubErrors.MERGE_REFUSED, {
        detail: `New commits were pushed to ${repository.fullName}#${address.number} since it was read (${expectedHead.slice(0, 7)} is now ${head.slice(0, 7)}); nothing was merged.`,
      });
    }
    await this.pulls.merge(writer, repository.fullName, address.number, method, head);
    await this.forget(reader, repository);
  }

  async enableAutoMerge(
    scope: AccessScope,
    userId: string,
    address: InstallationPullRequestAddress,
    method: 'squash' | 'merge' | 'rebase',
  ): Promise<boolean> {
    const { repository, writer, reader, head, nodeId } = await this.forWrite(
      scope,
      userId,
      address,
    );
    const enabled = await this.pulls.enableAutoMerge(writer, nodeId, method, head);
    await this.forget(reader, repository);
    return enabled;
  }

  /** The repository, the caller's own token and the head commit a write lands on. */
  private async forWrite(
    scope: AccessScope,
    userId: string,
    address: InstallationPullRequestAddress,
  ) {
    const repository = await this.access.repositoryOf(scope, address);
    const writer = await this.access.writeCredential(userId, address);
    const credential = await this.access.readCredential(scope, address);
    const pull = await this.pulls.readPullRequest(credential, repository.fullName, address.number);
    return { repository, writer, reader: credential, head: pull.headSha, nodeId: pull.nodeId };
  }

  private async forget(
    credential: GithubCredential,
    repository: WorkspaceRepository,
  ): Promise<void> {
    const keys = openListingKeys(credential, repository);
    await Promise.all([this.cache.del(keys.graph), this.cache.del(keys.rest)]);
  }
}
