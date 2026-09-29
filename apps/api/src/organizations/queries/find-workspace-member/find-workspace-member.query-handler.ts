import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { OrganizationRepositoryPort } from '../../database/organization.repository.port';
import { OrganizationErrors } from '../../domain/organization.errors';
import type { WorkspaceMember } from '../../domain/organization.types';
import { ORGANIZATION_REPOSITORY } from '../../organizations.di-tokens';
import { FindWorkspaceMemberQuery } from './find-workspace-member.query';

/**
 * Someone's place in a workspace, for a command to answer with.
 */
@QueryHandler(FindWorkspaceMemberQuery)
export class FindWorkspaceMemberQueryHandler
  implements IQueryHandler<FindWorkspaceMemberQuery, WorkspaceMember>
{
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizations: OrganizationRepositoryPort,
  ) {}

  async execute(query: FindWorkspaceMemberQuery): Promise<WorkspaceMember> {
    const found = await this.organizations.findWorkspaceMember(query.workspaceId, query.userId);
    if (found.isNone()) throw new AppError(OrganizationErrors.MEMBER_NOT_FOUND);
    return found.unwrap();
  }
}
