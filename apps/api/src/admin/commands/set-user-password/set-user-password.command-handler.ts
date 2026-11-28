import { Inject, Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { CompletePasswordResetCommand } from '../../../auth/commands/complete-password-reset/complete-password-reset.command';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import { AdminErrors } from '../../domain/admin.errors';
import type { AdminSuccessResponseDto } from '../../dtos/admin-user.response.dto';
import type { AdminAuthPort } from '../../infrastructure/admin-auth.port';
import { SetUserPasswordCommand } from './set-user-password.command';

/**
 * Sets an account's password without knowing the current one, and takes back
 * what a password reset takes back. Setting a password is how an
 * administrator hands an account to the person it belongs to, so whoever held
 * it before must not keep a way in: Better Auth's `setUserPassword` only
 * rewrites the hash, so this then runs `CompletePasswordResetCommand` (the
 * credential cutoff, the OAuth grants, the API tokens, and the hosts and
 * webhook URLs issued from an unverified address) and signs the account's
 * sessions out, as "Forgot password" does.
 *
 * In that order, like a reset: if taking the credentials back fails, the
 * password is set and the sessions are alive, and the administrator is told
 * to set it again (`ADMIN_008`); the command is idempotent, so that retry is
 * safe and completes it.
 */
@CommandHandler(SetUserPasswordCommand)
export class SetUserPasswordCommandHandler
  implements ICommandHandler<SetUserPasswordCommand, AdminSuccessResponseDto>
{
  private readonly logger = new Logger(SetUserPasswordCommandHandler.name);

  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: SetUserPasswordCommand): Promise<AdminSuccessResponseDto> {
    const result = await this.admin.setPassword(
      command.headers,
      command.userId,
      command.newPassword,
    );
    try {
      await this.commandBus.execute(
        new CompletePasswordResetCommand({ userId: command.userId, resetAt: new Date() }),
      );
    } catch (error) {
      this.logger.error(
        {
          message: 'Could not revoke the credentials of an account whose password was set',
          userId: command.userId,
        },
        error instanceof Error ? error.stack : String(error),
      );
      throw new AppError(AdminErrors.UPSTREAM_FAILED, {
        detail:
          'The password was set, but the credentials issued before it could not be revoked. Set the password again.',
      });
    }
    await this.admin.endSessions(command.userId);
    return result;
  }
}
