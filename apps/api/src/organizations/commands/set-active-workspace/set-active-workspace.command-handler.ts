import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { WorkspaceResponseDto } from '../../dtos/workspace.response.dto';
import type { WorkspaceAuthPort } from '../../infrastructure/workspace-auth.port';
import { WORKSPACE_AUTH } from '../../organizations.di-tokens';
import { SetActiveWorkspaceCommand } from './set-active-workspace.command';

/** Selects the workspace the caller's session acts in. */
@CommandHandler(SetActiveWorkspaceCommand)
export class SetActiveWorkspaceCommandHandler
  implements ICommandHandler<SetActiveWorkspaceCommand, WorkspaceResponseDto | null>
{
  constructor(
    @Inject(WORKSPACE_AUTH)
    private readonly workspaces: WorkspaceAuthPort,
  ) {}

  execute(command: SetActiveWorkspaceCommand): Promise<WorkspaceResponseDto | null> {
    return this.workspaces.setActive(command.headers, command.workspaceId);
  }
}
