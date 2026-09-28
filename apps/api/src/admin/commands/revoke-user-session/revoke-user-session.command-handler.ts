import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import type { AdminSuccessResponseDto } from '../../dtos/admin-user.response.dto';
import type { AdminAuthPort } from '../../infrastructure/admin-auth.port';
import { RevokeUserSessionCommand } from './revoke-user-session.command';

/** Signs one of an account's devices out, named by the session's id. */
@CommandHandler(RevokeUserSessionCommand)
export class RevokeUserSessionCommandHandler
  implements ICommandHandler<RevokeUserSessionCommand, AdminSuccessResponseDto>
{
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  execute(command: RevokeUserSessionCommand): Promise<AdminSuccessResponseDto> {
    return this.admin.revokeSessionById(command.headers, command.userId, command.sessionId);
  }
}
