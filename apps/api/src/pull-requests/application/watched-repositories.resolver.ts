import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type {
  PullRequestAccessPort,
  WorkspaceRepository,
} from '../../github/application/pull-request-access.port';
import { PULL_REQUEST_ACCESS } from '../../github/github.di-tokens';
import type { WatchedRepositoryRepositoryPort } from '../database/watched-repository.repository.port';
import { PullRequestsErrors } from '../domain/pull-requests.errors';
import { WATCHED_REPOSITORY_REPOSITORY } from '../pull-requests.di-tokens';

const keyOf = (r: { installationId: string; githubRepoId: number }) =>
  `${r.installationId}:${r.githubRepoId}`;

/**
 * Which of the workspace's repositories the caller watches: the ones they
 * have a watch row for, and nothing until they pick one. The queue's Watching scope and the
 * analytics read through this, so both look at the same repositories.
 */
@Injectable()
export class WatchedRepositoriesResolver {
  constructor(
    @Inject(PULL_REQUEST_ACCESS)
    private readonly access: PullRequestAccessPort,
    @Inject(WATCHED_REPOSITORY_REPOSITORY)
    private readonly watches: WatchedRepositoryRepositoryPort,
  ) {}

  /** Every repository, each with whether the caller watches it. */
  async all(scope: AccessScope): Promise<{ repository: WorkspaceRepository; watching: boolean }[]> {
    if (!scope.organizationId) throw new AppError(PullRequestsErrors.NO_ACTIVE_ORGANIZATION);
    const [repositories, watches] = await Promise.all([
      this.access.repositories(scope),
      this.watches.findOwn(scope),
    ]);
    const watched = new Set(watches.map(keyOf));
    return repositories.map((repository) => ({
      repository,
      watching: watched.has(keyOf(repository)),
    }));
  }

  async watched(scope: AccessScope): Promise<WorkspaceRepository[]> {
    return (await this.all(scope))
      .filter((entry) => entry.watching)
      .map((entry) => entry.repository);
  }
}
