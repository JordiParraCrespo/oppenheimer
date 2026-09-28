import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import { AdminErrors } from '../../domain/admin.errors';
import type { AdminSuccessResponseDto } from '../../dtos/admin-user.response.dto';
import type { AdminAuthPort } from '../../infrastructure/admin-auth.port';
import { RevokeUserSessionCommand } from './revoke-user-session.command';

/**
 * Signs one of an account's devices out, named by the session's **id**.
 *
 * Better Auth revokes by token, and a token is a live bearer credential, so a
 * client never sees one: the id is resolved to its token inside the API, and a
 * session that is not this user's is reported as not found.
 */
@CommandHandler(RevokeUserSessionCommand)
export class RevokeUserSessionCommandHandler
  implements ICommandHandler<RevokeUserSessionCommand, AdminSuccessResponseDto>
{
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  async execute(command: RevokeUserSessionCommand): Promise<AdminSuccessResponseDto> {
    const token = await this.admin.sessionToken(command.headers, command.userId, command.sessionId);
    if (!token) throw new AppError(AdminErrors.SESSION_NOT_FOUND);
    return this.admin.revokeSession(command.headers, token);
  }
}
