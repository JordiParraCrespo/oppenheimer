import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { WorkspaceResponseDto } from '../../dtos/workspace.response.dto';
import type { WorkspaceAuthPort } from '../../infrastructure/workspace-auth.port';
import { WORKSPACE_AUTH } from '../../organizations.di-tokens';
import { RenameWorkspaceCommand } from './rename-workspace.command';

/** Renames a workspace. */
@CommandHandler(RenameWorkspaceCommand)
export class RenameWorkspaceCommandHandler
  implements ICommandHandler<RenameWorkspaceCommand, WorkspaceResponseDto>
{
  constructor(
    @Inject(WORKSPACE_AUTH)
    private readonly workspaces: WorkspaceAuthPort,
  ) {}

  execute(command: RenameWorkspaceCommand): Promise<WorkspaceResponseDto> {
    return this.workspaces.rename(command.headers, command.workspaceId, command.name);
  }
}
