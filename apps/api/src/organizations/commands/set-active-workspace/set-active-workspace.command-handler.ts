import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { WorkspaceAuthPort } from '../../infrastructure/workspace-auth.port';
import { WORKSPACE_AUTH } from '../../organizations.di-tokens';
import { SetActiveWorkspaceCommand } from './set-active-workspace.command';

@CommandHandler(SetActiveWorkspaceCommand)
export class SetActiveWorkspaceCommandHandler
  implements ICommandHandler<SetActiveWorkspaceCommand, AggregateID>
{
  constructor(
    @Inject(WORKSPACE_AUTH)
    private readonly workspaces: WorkspaceAuthPort,
  ) {}

  async execute(command: SetActiveWorkspaceCommand): Promise<AggregateID> {
    await this.workspaces.setActive(command.headers, command.workspaceId);
    return command.workspaceId;
  }
}
