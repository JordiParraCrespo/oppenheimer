import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { isOrganizationAllowed } from '@oppenheimer/shared';
import type { WorkspaceResponseDto } from '../../dtos/workspace.response.dto';
import type { WorkspaceAuthPort } from '../../infrastructure/workspace-auth.port';
import { WORKSPACE_AUTH } from '../../organizations.di-tokens';
import { ListMyWorkspacesQuery } from './list-my-workspaces.query';

/** The workspaces the caller is in, across their organizations. */
@QueryHandler(ListMyWorkspacesQuery)
export class ListMyWorkspacesQueryHandler
  implements IQueryHandler<ListMyWorkspacesQuery, WorkspaceResponseDto[]>
{
  constructor(
    @Inject(WORKSPACE_AUTH)
    private readonly workspaces: WorkspaceAuthPort,
  ) {}

  async execute(query: ListMyWorkspacesQuery): Promise<WorkspaceResponseDto[]> {
    const workspaces = await this.workspaces.listForCaller(query.headers);
    // Same rule as `GET /organizations`: a collection names no organization
    // for `ScopesGuard`, so the credential's restriction is applied per row.
    return workspaces.filter((workspace) =>
      isOrganizationAllowed(query.resourceScope, workspace.organizationId),
    );
  }
}
