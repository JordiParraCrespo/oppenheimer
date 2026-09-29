import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { WorkspaceAuthPort } from '../../infrastructure/workspace-auth.port';
import { WORKSPACE_AUTH } from '../../organizations.di-tokens';
import { DeleteWorkspaceCommand } from './delete-workspace.command';

/** Deletes a workspace. */
@CommandHandler(DeleteWorkspaceCommand)
export class DeleteWorkspaceCommandHandler
  implements ICommandHandler<DeleteWorkspaceCommand, void>
{
  constructor(
    @Inject(WORKSPACE_AUTH)
    private readonly workspaces: WorkspaceAuthPort,
  ) {}

  execute(command: DeleteWorkspaceCommand): Promise<void> {
    return this.workspaces.remove(command.headers, command.workspaceId);
  }
}
