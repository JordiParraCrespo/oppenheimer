import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { WorkspaceAuthPort } from '../../infrastructure/workspace-auth.port';
import { WORKSPACE_AUTH } from '../../organizations.di-tokens';
import { RenameWorkspaceCommand } from './rename-workspace.command';

/** Renames a workspace. */
@CommandHandler(RenameWorkspaceCommand)
export class RenameWorkspaceCommandHandler
  implements ICommandHandler<RenameWorkspaceCommand, AggregateID>
{
  constructor(
    @Inject(WORKSPACE_AUTH)
    private readonly workspaces: WorkspaceAuthPort,
  ) {}

  async execute(command: RenameWorkspaceCommand): Promise<AggregateID> {
    await this.workspaces.rename(command.headers, command.workspaceId, command.name);
    return command.workspaceId;
  }
}
