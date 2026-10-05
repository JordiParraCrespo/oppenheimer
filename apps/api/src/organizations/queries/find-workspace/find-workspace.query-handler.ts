import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { OrganizationRepositoryPort } from '../../database/organization.repository.port';
import { OrganizationErrors } from '../../domain/organization.errors';
import type { Workspace } from '../../domain/organization.types';
import { ORGANIZATION_REPOSITORY } from '../../organizations.di-tokens';
import { FindWorkspaceQuery } from './find-workspace.query';

/**
 * A workspace as the app last wrote it, for a command to answer with.
 */
@QueryHandler(FindWorkspaceQuery)
export class FindWorkspaceQueryHandler implements IQueryHandler<FindWorkspaceQuery, Workspace> {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizations: OrganizationRepositoryPort,
  ) {}

  async execute(query: FindWorkspaceQuery): Promise<Workspace> {
    const found = await this.organizations.findWorkspace(query.workspaceId);
    if (found.isNone()) throw new AppError(OrganizationErrors.TEAM_NOT_FOUND);
    return found.unwrap();
  }
}
