import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { FullOrganizationResponseDto } from '../../dtos/organization.response.dto';
import type { OrganizationAuthPort } from '../../infrastructure/organization-auth.port';
import { ORGANIZATION_AUTH } from '../../organizations.di-tokens';
import { GetOrganizationQuery } from './get-organization.query';

@QueryHandler(GetOrganizationQuery)
export class GetOrganizationQueryHandler
  implements IQueryHandler<GetOrganizationQuery, FullOrganizationResponseDto | null>
{
  constructor(
    @Inject(ORGANIZATION_AUTH)
    private readonly organizations: OrganizationAuthPort,
  ) {}

  execute(query: GetOrganizationQuery): Promise<FullOrganizationResponseDto | null> {
    return this.organizations.getFull(query.headers, query.organizationId);
  }
}
