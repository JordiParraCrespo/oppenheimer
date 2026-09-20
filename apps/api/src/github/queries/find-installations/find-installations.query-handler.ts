import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { GithubInstallationRepositoryPort } from '../../database/github-installation.repository.port';
import type { GithubInstallationEntity } from '../../domain/github-installation.entity';
import { GITHUB_INSTALLATION_REPOSITORY } from '../../github.di-tokens';
import { FindInstallationsQuery } from './find-installations.query';

@QueryHandler(FindInstallationsQuery)
export class FindInstallationsQueryHandler
  implements IQueryHandler<FindInstallationsQuery, GithubInstallationEntity[]>
{
  constructor(
    @Inject(GITHUB_INSTALLATION_REPOSITORY)
    private readonly installations: GithubInstallationRepositoryPort,
  ) {}

  async execute(query: FindInstallationsQuery): Promise<GithubInstallationEntity[]> {
    return this.installations.findAll(query.scope);
  }
}
