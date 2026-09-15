import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { RoleRepositoryPort } from '../../database/role.repository.port';
import { RoleErrors } from '../../domain/role.errors';
import { ROLE_REPOSITORY } from '../../roles.di-tokens';
import { RoleGrantPolicy } from '../../services/role-grant.policy';
import { DeleteRoleCommand } from './delete-role.command';

/**
 * Deletes a custom role. System roles are protected. Existing assignments in
 * the `user_role` join are removed by the database cascade.
 */
@CommandHandler(DeleteRoleCommand)
export class DeleteRoleService implements ICommandHandler<DeleteRoleCommand, void> {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepositoryPort,
    private readonly grantPolicy: RoleGrantPolicy,
  ) {}

  async execute(command: DeleteRoleCommand): Promise<void> {
    const found = await this.roleRepository.findOneById(
      command.roleId,
      command.activeOrganizationId,
    );
    if (found.isNone()) throw new AppError(RoleErrors.NOT_FOUND);

    const role = found.unwrap();
    if (role.isSystem) throw new AppError(RoleErrors.SYSTEM_ROLE_IMMUTABLE);
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

    role.delete();
    await this.roleRepository.delete(role);
  }
}
