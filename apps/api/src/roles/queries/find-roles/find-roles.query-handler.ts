import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { Paginated } from '@oppenheimer/backend-ddd';
import type { RoleRepositoryPort } from '../../database/role.repository.port';
import type { RoleEntity } from '../../domain/role.entity';
import { ROLE_REPOSITORY } from '../../roles.di-tokens';
import { FindRolesQuery } from './find-roles.query';

@QueryHandler(FindRolesQuery)
export class FindRolesQueryHandler implements IQueryHandler<FindRolesQuery, Paginated<RoleEntity>> {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepositoryPort,
  ) {}

  execute(query: FindRolesQuery): Promise<Paginated<RoleEntity>> {
    return this.roleRepository.findRoles({
      page: query.page,
      limit: query.limit,
      search: query.search,
      organizationId: query.activeOrganizationId,
    });
  }
}
