import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { RoleGrantPolicy } from '../../application/role-grant.policy';
import type { RoleRepositoryPort } from '../../database/role.repository.port';
import { RoleEntity } from '../../domain/role.entity';
import { RoleErrors } from '../../domain/role.errors';
import { Permission } from '../../domain/value-objects/permission.value-object';
import { ROLE_REPOSITORY } from '../../roles.di-tokens';
import { CreateRoleCommand } from './create-role.command';

/** Creates a new custom role with its initial permission set. */
@CommandHandler(CreateRoleCommand)
export class CreateRoleCommandHandler implements ICommandHandler<CreateRoleCommand, AggregateID> {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepositoryPort,
    private readonly grantPolicy: RoleGrantPolicy,
  ) {}

  async execute(command: CreateRoleCommand): Promise<AggregateID> {
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

    const existing = await this.roleRepository.findOneByName(
      command.name,
      command.activeOrganizationId,
    );
    if (existing.isSome()) throw new AppError(RoleErrors.NAME_TAKEN);

    const role = RoleEntity.createNew({
      name: command.name,
      description: command.description,
      // A role created inside an organization belongs to it. Global roles are
      // seeded, not created through the API.
      organizationId: command.activeOrganizationId ?? null,
      permissions: command.permissions.map((permission) => Permission.fromDefinition(permission)),
    });

    await this.roleRepository.insert(role);
    return role.id;
  }
}
