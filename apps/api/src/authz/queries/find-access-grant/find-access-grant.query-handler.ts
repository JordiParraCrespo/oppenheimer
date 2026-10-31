import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import { requireTenant } from '../../application/tenant-scope.policy';
import { ACCESS_GRANT_REPOSITORY } from '../../authz.di-tokens';
import type { AccessGrantRepositoryPort } from '../../database/access-grant.repository.port';
import type { AccessGrantEntity } from '../../domain/access-grant.entity';
import { AccessGrantErrors } from '../../domain/access-grant.errors';
import { FindAccessGrantQuery } from './find-access-grant.query';

@QueryHandler(FindAccessGrantQuery)
export class FindAccessGrantQueryHandler
  implements IQueryHandler<FindAccessGrantQuery, AccessGrantEntity>
{
  constructor(
    @Inject(ACCESS_GRANT_REPOSITORY)
    private readonly grants: AccessGrantRepositoryPort,
  ) {}

  async execute(query: FindAccessGrantQuery): Promise<AccessGrantEntity> {
    requireTenant(query.scope);
    const found = await this.grants.findOneInOrganization(
      query.scope.organizationId,
      query.grantId,
    );
    return requireFound(found, AccessGrantErrors.NOT_FOUND, {
      detail: `No access grant with id ${query.grantId}`,
    });
  }
}
