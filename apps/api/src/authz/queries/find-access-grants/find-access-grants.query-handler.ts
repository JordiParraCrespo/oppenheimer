import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { Paginated } from '@oppenheimer/backend-ddd';
import { requireTenant } from '../../application/tenant-scope.policy';
import { ACCESS_GRANT_REPOSITORY } from '../../authz.di-tokens';
import type { AccessGrantRepositoryPort } from '../../database/access-grant.repository.port';
import type { AccessGrantEntity } from '../../domain/access-grant.entity';
import { FindAccessGrantsQuery } from './find-access-grants.query';

@QueryHandler(FindAccessGrantsQuery)
export class FindAccessGrantsQueryHandler
  implements IQueryHandler<FindAccessGrantsQuery, Paginated<AccessGrantEntity>>
{
  constructor(
    @Inject(ACCESS_GRANT_REPOSITORY)
    private readonly grants: AccessGrantRepositoryPort,
  ) {}

  async execute(query: FindAccessGrantsQuery): Promise<Paginated<AccessGrantEntity>> {
    requireTenant(query.scope);
    return this.grants.findPageInOrganization(query.scope.organizationId, {
      page: query.page,
      limit: query.limit,
    });
  }
}
