import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { WorkspaceAuthPort } from '../../infrastructure/workspace-auth.port';
import { WORKSPACE_AUTH } from '../../organizations.di-tokens';
import { CreateWorkspaceCommand } from './create-workspace.command';

@CommandHandler(CreateWorkspaceCommand)
export class CreateWorkspaceCommandHandler
  implements ICommandHandler<CreateWorkspaceCommand, AggregateID>
{
  constructor(
    @Inject(WORKSPACE_AUTH)
    private readonly workspaces: WorkspaceAuthPort,
  ) {}

  async execute(command: CreateWorkspaceCommand): Promise<AggregateID> {
    const workspace = await this.workspaces.create(command.headers, {
      name: command.name,
      organizationId: command.organizationId,
    });
    return workspace.id;
  }
}
