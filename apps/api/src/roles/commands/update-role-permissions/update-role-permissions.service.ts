import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { RoleRepositoryPort } from '../../database/role.repository.port';
import { RoleEntity } from '../../domain/role.entity';
import { RoleErrors } from '../../domain/role.errors';
import { Permission } from '../../domain/value-objects/permission.value-object';
import { ROLE_REPOSITORY } from '../../roles.di-tokens';
import { RoleGrantPolicy } from '../../services/role-grant.policy';
import { UpdateRolePermissionsCommand } from './update-role-permissions.command';

/** Replaces a role's full permission set — the granular permission editor. */
@CommandHandler(UpdateRolePermissionsCommand)
export class UpdateRolePermissionsService
  implements ICommandHandler<UpdateRolePermissionsCommand, AggregateID>
{
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepositoryPort,
    private readonly grantPolicy: RoleGrantPolicy,
  ) {}

  async execute(command: UpdateRolePermissionsCommand): Promise<AggregateID> {
    // No privilege escalation: the author must already hold everything they
    // are putting on the role.
    await this.grantPolicy.assertGrantable(
      command.actorId
        ? {
            id: command.actorId,
            role: command.actorRole,
            activeOrganizationId: command.activeOrganizationId,
          }
        : undefined,
      command.permissions,
    );

    const found = await this.roleRepository.findOneById(
      command.roleId,
      command.activeOrganizationId,
    );
    if (found.isNone()) throw new AppError(RoleErrors.NOT_FOUND);

    const role = found.unwrap();
    await this.grantPolicy.assertCanModify(
      command.actorId
        ? {
            id: command.actorId,
            role: command.actorRole,
            activeOrganizationId: command.activeOrganizationId,
          }
        : undefined,
      role,
    );
    const permissions = command.permissions.map((permission) =>
      Permission.fromDefinition(permission),
    );

    // Never let a full-access system role (e.g. `admin`) be stripped of its
    // `manage all` rule — that would lock every admin out of the platform.
    if (role.isSystem && role.hasFullAccess() && !RoleEntity.grantsFullAccess(permissions)) {
      throw new AppError(RoleErrors.ADMIN_LOCKOUT);
    }

    role.replacePermissions(permissions);

    await this.roleRepository.save(role);
    return role.id;
  }
}
