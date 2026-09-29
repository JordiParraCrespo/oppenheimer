import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { WorkspaceAuthPort } from '../../infrastructure/workspace-auth.port';
import { WORKSPACE_AUTH } from '../../organizations.di-tokens';
import { AddWorkspaceMemberCommand } from './add-workspace-member.command';

@CommandHandler(AddWorkspaceMemberCommand)
export class AddWorkspaceMemberCommandHandler
  implements ICommandHandler<AddWorkspaceMemberCommand, void>
{
  constructor(
    @Inject(WORKSPACE_AUTH)
    private readonly workspaces: WorkspaceAuthPort,
  ) {}

  async execute(command: AddWorkspaceMemberCommand): Promise<void> {
    await this.workspaces.addMember(command.headers, command.workspaceId, command.userId);
  }
}
