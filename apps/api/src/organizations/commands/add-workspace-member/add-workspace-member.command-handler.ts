import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { WorkspaceMemberResponseDto } from '../../dtos/workspace.response.dto';
import type { WorkspaceAuthPort } from '../../infrastructure/workspace-auth.port';
import { WORKSPACE_AUTH } from '../../organizations.di-tokens';
import { AddWorkspaceMemberCommand } from './add-workspace-member.command';

/** Puts a member of the organization into one of its workspaces. */
@CommandHandler(AddWorkspaceMemberCommand)
export class AddWorkspaceMemberCommandHandler
  implements ICommandHandler<AddWorkspaceMemberCommand, WorkspaceMemberResponseDto>
{
  constructor(
    @Inject(WORKSPACE_AUTH)
    private readonly workspaces: WorkspaceAuthPort,
  ) {}

  execute(command: AddWorkspaceMemberCommand): Promise<WorkspaceMemberResponseDto> {
    return this.workspaces.addMember(command.headers, command.workspaceId, command.userId);
  }
}
