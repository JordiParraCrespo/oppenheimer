import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { UserRoleRepositoryPort } from '../../database/user-role.repository.port';
import type { RoleEntity } from '../../domain/role.entity';
import { USER_ROLE_REPOSITORY } from '../../roles.di-tokens';
import { FindUserRolesQuery } from './find-user-roles.query';

@QueryHandler(FindUserRolesQuery)
export class FindUserRolesQueryHandler implements IQueryHandler<FindUserRolesQuery, RoleEntity[]> {
  constructor(
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoleRepository: UserRoleRepositoryPort,
  ) {}

  execute(query: FindUserRolesQuery): Promise<RoleEntity[]> {
    return this.userRoleRepository.findRolesForUser(query.userId, query.activeOrganizationId);
  }
}
