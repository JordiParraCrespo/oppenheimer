import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { WorkspaceAuthPort } from '../../infrastructure/workspace-auth.port';
import { WORKSPACE_AUTH } from '../../organizations.di-tokens';
import { RemoveWorkspaceMemberCommand } from './remove-workspace-member.command';

/** Takes someone out of a workspace; they stay in the organization. */
@CommandHandler(RemoveWorkspaceMemberCommand)
export class RemoveWorkspaceMemberCommandHandler
  implements ICommandHandler<RemoveWorkspaceMemberCommand, void>
{
  constructor(
    @Inject(WORKSPACE_AUTH)
    private readonly workspaces: WorkspaceAuthPort,
  ) {}

  execute(command: RemoveWorkspaceMemberCommand): Promise<void> {
    return this.workspaces.removeMember(command.headers, command.workspaceId, command.userId);
  }
}
