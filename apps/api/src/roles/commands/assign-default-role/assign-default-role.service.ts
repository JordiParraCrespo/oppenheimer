import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { ROLES } from '@oppenheimer/shared';
import type { RoleRepositoryPort } from '../../database/role.repository.port';
import type { UserRoleRepositoryPort } from '../../database/user-role.repository.port';
import { RoleErrors } from '../../domain/role.errors';
import { ROLE_REPOSITORY, USER_ROLE_REPOSITORY } from '../../roles.di-tokens';
import { AssignDefaultRoleCommand } from './assign-default-role.command';

/**
 * Assigns the default `user` role through the `user_role` join, so a new
 * sign-up draws its permissions from the same source as everyone else rather
 * than from the legacy `user.role` column the `AbilityFactory` only falls back
 * to.
 *
 * Additive and repeatable: it grants one role and never revokes another, and
 * granting it twice is a no-op.
 */
@CommandHandler(AssignDefaultRoleCommand)
export class AssignDefaultRoleService implements ICommandHandler<AssignDefaultRoleCommand, void> {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roles: RoleRepositoryPort,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoles: UserRoleRepositoryPort,
  ) {}

  async execute(command: AssignDefaultRoleCommand): Promise<void> {
    // Global scope: the default role applies wherever the account goes, unlike
    // the org-scoped `owner` its personal workspace grants.
    const role = await this.roles.findOneByName(ROLES.USER, null);
    if (role.isNone()) {
      throw new AppError(RoleErrors.NOT_FOUND, {
        detail: `The default system role "${ROLES.USER}" is missing. Run the migrations.`,
        extensions: { userId: command.userId },
      });
    }

    await this.userRoles.assignRoleToUser(command.userId, role.unwrap().id, null);
  }
}
