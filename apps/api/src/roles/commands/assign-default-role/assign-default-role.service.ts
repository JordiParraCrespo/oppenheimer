import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ROLES } from '@oppenheimer/shared';
import type { RoleRepositoryPort } from '../../database/role.repository.port';
import type { UserRoleRepositoryPort } from '../../database/user-role.repository.port';
import { missingSystemRole } from '../../missing-system-role';
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
    // Not `NOT_FOUND`: nobody asked for this role by name, so a 404 would
    // describe a caller mistake that did not happen. See `missingSystemRole`.
    if (role.isNone()) throw missingSystemRole(ROLES.USER, command.userId);

    await this.userRoles.assignRoleToUser(command.userId, role.unwrap().id, null);
  }
}
