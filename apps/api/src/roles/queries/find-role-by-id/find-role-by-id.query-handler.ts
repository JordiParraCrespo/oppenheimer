import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { RoleRepositoryPort } from '../../database/role.repository.port';
import type { RoleEntity } from '../../domain/role.entity';
import { RoleErrors } from '../../domain/role.errors';
import { ROLE_REPOSITORY } from '../../roles.di-tokens';
import { FindRoleByIdQuery } from './find-role-by-id.query';

@QueryHandler(FindRoleByIdQuery)
export class FindRoleByIdQueryHandler implements IQueryHandler<FindRoleByIdQuery, RoleEntity> {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepositoryPort,
  ) {}

  async execute(query: FindRoleByIdQuery): Promise<RoleEntity> {
    const found = await this.roleRepository.findOneById(query.roleId, query.activeOrganizationId);
    if (found.isNone()) throw new AppError(RoleErrors.NOT_FOUND);
    return found.unwrap();
  }
}
