import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import type { AdminSuccessResponseDto } from '../../dtos/admin-user.response.dto';
import type { AdminAuthPort } from '../../infrastructure/admin-auth.port';
import { RevokeUserSessionsCommand } from './revoke-user-sessions.command';

@CommandHandler(RevokeUserSessionsCommand)
export class RevokeUserSessionsCommandHandler
  implements ICommandHandler<RevokeUserSessionsCommand, AdminSuccessResponseDto>
{
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  execute(command: RevokeUserSessionsCommand): Promise<AdminSuccessResponseDto> {
    return this.admin.revokeAllSessions(command.headers, command.userId);
  }
}
