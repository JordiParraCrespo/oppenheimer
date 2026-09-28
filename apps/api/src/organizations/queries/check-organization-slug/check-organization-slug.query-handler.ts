import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { SlugAvailabilityResponseDto } from '../../dtos/organization.response.dto';
import type { OrganizationAuthPort } from '../../infrastructure/organization-auth.port';
import { ORGANIZATION_AUTH } from '../../organizations.di-tokens';
import { CheckOrganizationSlugQuery } from './check-organization-slug.query';

/** Whether a slug is free to give a new organization. */
@QueryHandler(CheckOrganizationSlugQuery)
export class CheckOrganizationSlugQueryHandler
  implements IQueryHandler<CheckOrganizationSlugQuery, SlugAvailabilityResponseDto>
{
  constructor(
    @Inject(ORGANIZATION_AUTH)
    private readonly organizations: OrganizationAuthPort,
  ) {}

  async execute(query: CheckOrganizationSlugQuery): Promise<SlugAvailabilityResponseDto> {
    return { available: await this.organizations.isSlugAvailable(query.headers, query.slug) };
  }
}
