import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { ProfileAuthPort } from '../../infrastructure/profile-auth.port';
import { PROFILE_AUTH } from '../../profile.di-tokens';
import { ChangePasswordCommand } from './change-password.command';

/**
 * Changes the caller's password.
 *
 * There is no domain step here on purpose: Better Auth owns the credential —
 * the hashing scheme, the account record, and invalidating the sessions the old
 * password minted. The handler exists so the operation is dispatched, guarded
 * and documented like every other write, not to add logic of its own.
 */
@CommandHandler(ChangePasswordCommand)
export class ChangePasswordCommandHandler implements ICommandHandler<ChangePasswordCommand, void> {
  constructor(
    @Inject(PROFILE_AUTH)
    private readonly profileAuth: ProfileAuthPort,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<void> {
    await this.profileAuth.changePassword(command.headers, {
      userId: command.userId,
      currentPassword: command.currentPassword,
      newPassword: command.newPassword,
      revokeOtherSessions: command.revokeOtherSessions,
    });
  }
}
