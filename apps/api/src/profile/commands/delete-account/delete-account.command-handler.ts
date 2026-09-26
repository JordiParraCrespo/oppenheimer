import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { UserRepositoryPort } from '../../../users/database/user.repository.port';
import { USER_REPOSITORY } from '../../../users/user.di-tokens';
import type { AccountErasurePort } from '../../database/account-erasure.repository.port';
import { ProfileErrors } from '../../domain/profile.errors';
import type { AvatarStoragePort } from '../../infrastructure/avatar-storage.port';
import type { WorkspaceShutdownPort } from '../../infrastructure/workspace-shutdown.port';
import { ACCOUNT_ERASURE, AVATAR_STORAGE, WORKSPACE_SHUTDOWN } from '../../profile.di-tokens';
import { DeleteAccountCommand } from './delete-account.command';

/**
 * Deletes the caller's own account, and with it the workspace nobody else is
 * in: "Stops every session and removes your automations and host
 * registrations" (Settings → Profile).
 *
 * In this order, because each step is only safe after the one before it:
 *
 * 1. **Confirm.** The typed confirmation must be the account's email.
 * 2. **Refuse shared work.** A session or GitHub installation the person
 *    left in a workspace someone else is in cannot be deleted for them.
 * 3. **Stop the sessions, unpair the hosts**, best-effort, while the rows
 *    that say where to send the stop still exist.
 * 4. **Erase** the workspaces' sessions, projects and the workspaces
 *    themselves, and every sign-in, in one transaction.
 * 5. **Delete the user** through its own repository, which raises
 *    `UserDeletedDomainEvent`; hosts, pairing tokens, API tokens, OAuth
 *    grants and preferences cascade from the row.
 * 6. **Remove the avatar** from storage, last: a stored file nothing points
 *    at is cheaper than a row pointing at a file that is gone.
 */
@CommandHandler(DeleteAccountCommand)
export class DeleteAccountCommandHandler implements ICommandHandler<DeleteAccountCommand, void> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(ACCOUNT_ERASURE)
    private readonly erasure: AccountErasurePort,
    @Inject(WORKSPACE_SHUTDOWN)
    private readonly shutdown: WorkspaceShutdownPort,
    @Inject(AVATAR_STORAGE)
    private readonly avatars: AvatarStoragePort,
  ) {}

  async execute(command: DeleteAccountCommand): Promise<void> {
    const found = await this.userRepository.findOneById(command.userId);
    if (found.isNone()) throw new AppError(ProfileErrors.NOT_FOUND);
    const user = found.unwrap();

    if (command.confirmation.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw new AppError(ProfileErrors.DELETE_CONFIRMATION_MISMATCH);
    }

    const workspaces = await this.erasure.findSoleWorkspaces(user.id);
    if (await this.erasure.hasSharedWork(user.id, workspaces)) {
      throw new AppError(ProfileErrors.ACCOUNT_HAS_SHARED_WORK);
    }

    await this.shutdown.stopSessions(user.id, workspaces);
    await this.shutdown.unpairHosts(user.id);

    await this.erasure.eraseWorkspaces(user.id, workspaces);
    user.delete();
    await this.userRepository.delete(user);
    await this.avatars.remove(user.avatarUrl);
  }
}
