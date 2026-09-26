import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { ACCESS_GRANT_REPOSITORY } from '../../authz.di-tokens';
import type { AccessGrantRepositoryPort } from '../../database/access-grant.repository.port';
import type { AccessGrantEntity } from '../../domain/access-grant.entity';
import { AccessGrantErrors } from '../../domain/access-grant.errors';
import { FindAccessGrantQuery } from './find-access-grant.query';

/**
 * Reads one grant back by id. Scoped to the organization, like revoke, so a
 * grant in another tenant reports as not found and ids stay un-probeable.
 */
@QueryHandler(FindAccessGrantQuery)
export class FindAccessGrantQueryHandler
  implements IQueryHandler<FindAccessGrantQuery, AccessGrantEntity>
{
  constructor(
    @Inject(ACCESS_GRANT_REPOSITORY)
    private readonly grants: AccessGrantRepositoryPort,
  ) {}

  async execute(query: FindAccessGrantQuery): Promise<AccessGrantEntity> {
    if (!query.scope.organizationId) {
      throw new AppError(AccessGrantErrors.NO_ACTIVE_ORGANIZATION);
    }
    const found = await this.grants.findOneInOrganization(
      query.scope.organizationId,
      query.grantId,
    );
    if (found.isNone()) {
      throw new AppError(AccessGrantErrors.NOT_FOUND, {
        detail: `No access grant with id ${query.grantId}`,
      });
    }
    return found.unwrap();
  }
}
