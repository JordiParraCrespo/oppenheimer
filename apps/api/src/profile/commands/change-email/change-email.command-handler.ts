import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { UserRepositoryPort } from '../../../users/database/user.repository.port';
import { USER_REPOSITORY } from '../../../users/user.di-tokens';
import { ProfileErrors } from '../../domain/profile.errors';
import type { ProfileAuthPort } from '../../infrastructure/profile-auth.port';
import { PROFILE_AUTH } from '../../profile.di-tokens';
import { ChangeEmailCommand } from './change-email.command';

/**
 * Asks to move the caller's account to another address. **It records a
 * request, not an outcome**: a link goes to the new address, and the account
 * moves only when that link is followed, which proves the address belongs to
 * the person asking. The address signs in and links social identities
 * (`requireLocalEmailVerified`), so it is never switched on the caller's word.
 *
 * Better Auth answers an address another account holds exactly as it answers
 * a free one, so this endpoint cannot be used to learn who has an account.
 * The one refusal of its own is the address the account already uses, which
 * the caller knows anyway.
 */
@CommandHandler(ChangeEmailCommand)
export class ChangeEmailCommandHandler implements ICommandHandler<ChangeEmailCommand, void> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PROFILE_AUTH)
    private readonly profileAuth: ProfileAuthPort,
  ) {}

  async execute(command: ChangeEmailCommand): Promise<void> {
    const found = await this.userRepository.findOneById(command.userId);
    if (found.isNone()) throw new AppError(ProfileErrors.NOT_FOUND);

    const newEmail = command.newEmail.trim().toLowerCase();
    if (newEmail === found.unwrap().email.toLowerCase()) {
      throw new AppError(ProfileErrors.EMAIL_UNCHANGED);
    }

    await this.profileAuth.requestEmailChange(command.headers, newEmail);
  }
}
