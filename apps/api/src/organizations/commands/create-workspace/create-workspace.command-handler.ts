import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { WorkspaceResponseDto } from '../../dtos/workspace.response.dto';
import type { WorkspaceAuthPort } from '../../infrastructure/workspace-auth.port';
import { WORKSPACE_AUTH } from '../../organizations.di-tokens';
import { CreateWorkspaceCommand } from './create-workspace.command';

/** Adds a workspace to an organization. */
@CommandHandler(CreateWorkspaceCommand)
export class CreateWorkspaceCommandHandler
  implements ICommandHandler<CreateWorkspaceCommand, WorkspaceResponseDto>
{
  constructor(
    @Inject(WORKSPACE_AUTH)
    private readonly workspaces: WorkspaceAuthPort,
  ) {}

  execute(command: CreateWorkspaceCommand): Promise<WorkspaceResponseDto> {
    return this.workspaces.create(command.headers, {
      name: command.name,
      organizationId: command.organizationId,
    });
  }
}
