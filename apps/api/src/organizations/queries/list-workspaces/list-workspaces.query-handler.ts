import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { WorkspaceResponseDto } from '../../dtos/workspace.response.dto';
import type { WorkspaceAuthPort } from '../../infrastructure/workspace-auth.port';
import { WORKSPACE_AUTH } from '../../organizations.di-tokens';
import { ListWorkspacesQuery } from './list-workspaces.query';

@QueryHandler(ListWorkspacesQuery)
export class ListWorkspacesQueryHandler
  implements IQueryHandler<ListWorkspacesQuery, WorkspaceResponseDto[]>
{
  constructor(
    @Inject(WORKSPACE_AUTH)
    private readonly workspaces: WorkspaceAuthPort,
  ) {}

  execute(query: ListWorkspacesQuery): Promise<WorkspaceResponseDto[]> {
    return this.workspaces.listForOrganization(query.headers, query.organizationId);
  }
}
