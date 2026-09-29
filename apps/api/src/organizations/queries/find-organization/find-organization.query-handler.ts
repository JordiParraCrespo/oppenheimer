import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { OrganizationRepositoryPort } from '../../database/organization.repository.port';
import { OrganizationErrors } from '../../domain/organization.errors';
import type { Organization } from '../../domain/organization.types';
import { ORGANIZATION_REPOSITORY } from '../../organizations.di-tokens';
import { FindOrganizationQuery } from './find-organization.query';

/**
 * An organization as the app last wrote it, for a command to answer with.
 */
@QueryHandler(FindOrganizationQuery)
export class FindOrganizationQueryHandler
  implements IQueryHandler<FindOrganizationQuery, Organization>
{
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizations: OrganizationRepositoryPort,
  ) {}

  async execute(query: FindOrganizationQuery): Promise<Organization> {
    const found = await this.organizations.findOrganization(query.organizationId);
    if (found.isNone()) throw new AppError(OrganizationErrors.NOT_FOUND);
    return found.unwrap();
  }
}
