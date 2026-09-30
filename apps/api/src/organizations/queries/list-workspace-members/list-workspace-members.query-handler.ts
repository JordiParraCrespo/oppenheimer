import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { WorkspaceMemberResponseDto } from '../../dtos/workspace.response.dto';
import type { WorkspaceAuthPort } from '../../infrastructure/workspace-auth.port';
import { WORKSPACE_AUTH } from '../../organizations.di-tokens';
import { ListWorkspaceMembersQuery } from './list-workspace-members.query';

@QueryHandler(ListWorkspaceMembersQuery)
export class ListWorkspaceMembersQueryHandler
  implements IQueryHandler<ListWorkspaceMembersQuery, WorkspaceMemberResponseDto[]>
{
  constructor(
    @Inject(WORKSPACE_AUTH)
    private readonly workspaces: WorkspaceAuthPort,
  ) {}

  execute(query: ListWorkspaceMembersQuery): Promise<WorkspaceMemberResponseDto[]> {
    return this.workspaces.listMembers(query.headers, query.workspaceId);
  }
}
