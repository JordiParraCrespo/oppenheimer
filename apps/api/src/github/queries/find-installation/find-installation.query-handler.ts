import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { GithubInstallationRepositoryPort } from '../../database/github-installation.repository.port';
import { GithubErrors } from '../../domain/github.errors';
import type { GithubInstallationEntity } from '../../domain/github-installation.entity';
import { GITHUB_INSTALLATION_REPOSITORY } from '../../github.di-tokens';
import { FindInstallationQuery } from './find-installation.query';

@QueryHandler(FindInstallationQuery)
export class FindInstallationQueryHandler
  implements IQueryHandler<FindInstallationQuery, GithubInstallationEntity>
{
  constructor(
    @Inject(GITHUB_INSTALLATION_REPOSITORY)
    private readonly installations: GithubInstallationRepositoryPort,
  ) {}

  async execute(query: FindInstallationQuery): Promise<GithubInstallationEntity> {
    const found = await this.installations.findOneById(query.scope, query.installationId);

    // An installation outside the caller's scope is reported as missing, not
    // forbidden: the scoped read cannot see it, and distinguishing the two would
    // confirm the id exists.
    if (found.isNone()) {
      throw new AppError(GithubErrors.INSTALLATION_NOT_FOUND, {
        detail: `No GitHub installation with id ${query.installationId}`,
      });
    }

    return found.unwrap();
  }
}
