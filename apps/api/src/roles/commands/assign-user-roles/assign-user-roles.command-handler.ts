import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { UserRepositoryPort } from '../../../users/database/user.repository.port';
import { UserErrors } from '../../../users/domain/user.errors';
import { USER_REPOSITORY } from '../../../users/user.di-tokens';
import { RoleGrantPolicy } from '../../application/role-grant.policy';
import type { RoleRepositoryPort } from '../../database/role.repository.port';
import type { UserRoleRepositoryPort } from '../../database/user-role.repository.port';
import { RoleErrors } from '../../domain/role.errors';
import { ROLE_REPOSITORY, USER_ROLE_REPOSITORY } from '../../roles.di-tokens';
import { AssignUserRolesCommand } from './assign-user-roles.command';

/**
 * Replaces the set of roles assigned to a user. Validates that the user and
 * every referenced role exist before writing the join, so callers get a clean
 * 404 rather than a foreign-key error.
 */
@CommandHandler(AssignUserRolesCommand)
export class AssignUserRolesCommandHandler
  implements ICommandHandler<AssignUserRolesCommand, void>
{
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepositoryPort,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoleRepository: UserRoleRepositoryPort,
    private readonly grantPolicy: RoleGrantPolicy,
  ) {}

  async execute(command: AssignUserRolesCommand): Promise<void> {
    const user = await this.userRepository.findOneById(command.userId);
    if (user.isNone()) throw new AppError(UserErrors.NOT_FOUND);

    const uniqueRoleIds = [...new Set(command.roleIds)];
    const roles =
      command.activeOrganizationId === undefined
        ? await this.roleRepository.findByIds(uniqueRoleIds)
        : await this.roleRepository.findByIds(uniqueRoleIds, command.activeOrganizationId);
    if (roles.length !== uniqueRoleIds.length) throw new AppError(RoleErrors.NOT_FOUND);

    // No privilege escalation: assigning a role grants its permissions to the
    // target, so the caller must already hold everything those roles confer.
    // `RoleGrantPolicy` guards role *definitions*; this closes the parallel
    // escalation path where a lesser admin assigns a role that outranks them.
    await this.grantPolicy.assertGrantable(
      command.actorId
        ? {
            id: command.actorId,
            role: command.actorRole,
            activeOrganizationId: command.activeOrganizationId,
          }
        : undefined,
      roles.flatMap((role) => role.permissions.map((permission) => permission.toDefinition())),
    );

    if (command.activeOrganizationId === undefined) {
      await this.userRoleRepository.setRolesForUser(command.userId, uniqueRoleIds);
    } else {
      await this.userRoleRepository.setRolesForUser(
        command.userId,
        uniqueRoleIds,
        command.activeOrganizationId,
      );
    }
  }
}
