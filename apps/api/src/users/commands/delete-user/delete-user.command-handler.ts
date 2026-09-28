import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionCachePort } from '../../../auth/application/session-cache.port';
import { SESSION_CACHE } from '../../../auth/auth.di-tokens';
import { AccountErasureRegistry } from '../../application/account-erasure.registry';
import type { UserRepositoryPort } from '../../database/user.repository.port';
import { UserErrors } from '../../domain/user.errors';
import { USER_REPOSITORY } from '../../user.di-tokens';
import { DeleteUserCommand } from './delete-user.command';

/**
 * Deletes an account — an admin's `DELETE /users/{id}` and a person's own
 * `DELETE /profile` are this one handler.
 *
 * What the account holds elsewhere goes first, through the owning modules'
 * contributions (`AccountErasureRegistry`): its hosts are unpaired, then the
 * personal workspace's sessions and projects go, then the workspace. The
 * user row goes last, and its sign-ins, tokens, grants, hosts and preferences
 * cascade from it in that one write, so no failure leaves an account that
 * exists with its sign-ins gone. Every step is idempotent, so a delete that
 * failed part way is simply asked again. The aggregate raises
 * `UserDeletedDomainEvent`, which the repository publishes after the delete.
 *
 * The cascade removes the session rows but not Better Auth's cached copies of
 * them, which would keep the deleted account's cookie working until it
 * expired. So the copies are evicted first — the sessions answer from the
 * database meanwhile, and a failure here stops the deletion before anything is
 * gone — and once more after the delete, for a sign-in that landed in between.
 */
@CommandHandler(DeleteUserCommand)
export class DeleteUserCommandHandler implements ICommandHandler<DeleteUserCommand, void> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    private readonly erasure: AccountErasureRegistry,
    @Inject(SESSION_CACHE)
    private readonly sessionCache: SessionCachePort,
  ) {}

  async execute(command: DeleteUserCommand): Promise<void> {
    const found = await this.userRepository.findOneById(command.userId);
    if (found.isNone()) throw new AppError(UserErrors.NOT_FOUND);
    const user = found.unwrap();

    if (
      command.confirmation !== undefined &&
      command.confirmation.trim().toLowerCase() !== user.email.toLowerCase()
    ) {
      throw new AppError(UserErrors.DELETE_CONFIRMATION_MISMATCH);
    }

    await this.sessionCache.evictUser(user.id);
    await this.erasure.eraseFor(user.id);
    user.delete();
    await this.userRepository.delete(user);
    await this.sessionCache.evictUser(user.id);
  }
}
