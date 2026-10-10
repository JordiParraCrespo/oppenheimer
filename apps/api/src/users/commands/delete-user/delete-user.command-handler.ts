import { ForbiddenException, Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionCachePort } from '../../../auth/application/session-cache.port';
import { SESSION_CACHE } from '../../../auth/auth.di-tokens';
import { AccountErasureRegistry } from '../../application/account-erasure.registry';
import type { UserRepositoryPort } from '../../database/user.repository.port';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserDeletedDomainEvent } from '../../domain/events/user-deleted.domain-event';
import { UserErrors } from '../../domain/user.errors';
import { USER_REPOSITORY } from '../../user.di-tokens';
import { DeleteUserCommand } from './delete-user.command';

/**
 * An admin's `DELETE /users/{id}` and a person's own `DELETE /profile`.
 *
 * What the account holds elsewhere goes first, through the owning modules'
 * contributions (`AccountErasureRegistry`). The user row goes last, and its sign-ins,
 * tokens, grants, hosts and preferences cascade from it in that one write, so no
 * failure leaves an account without its sign-ins. Every step is idempotent, so a
 * delete that failed part way is asked again.
 *
 * The cascade leaves Better Auth's cached session copies, which would keep the deleted
 * account's cookie working until expiry, so they are evicted first (a failure stops
 * the deletion before anything is gone) and again after the delete, for a sign-in that
 * landed in between.
 */
@CommandHandler(DeleteUserCommand)
export class DeleteUserCommandHandler implements ICommandHandler<DeleteUserCommand, void> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    private readonly events: EventEmitter2,
    private readonly erasure: AccountErasureRegistry,
    @Inject(SESSION_CACHE)
    private readonly sessionCache: SessionCachePort,
  ) {}

  async execute(command: DeleteUserCommand): Promise<void> {
    const found = await this.userRepository.findOneById(command.userId);
    if (found.isNone()) throw new AppError(UserErrors.NOT_FOUND);
    const user = found.unwrap();
    if (user.role === 'admin') {
      throw new ForbiddenException('Admins cannot be deleted through this endpoint');
    }

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
    this.events.emit(
      'UserDeletedDomainEvent',
      new UserDeletedDomainEvent({ aggregateId: user.id, email: user.email }),
    );
    await this.sessionCache.evictUser(user.id);
  }
}
