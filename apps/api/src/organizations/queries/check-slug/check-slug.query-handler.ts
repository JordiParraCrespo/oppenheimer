import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { SlugAvailabilityResponseDto } from '../../dtos/organization.response.dto';
import type { OrganizationAuthPort } from '../../infrastructure/organization-auth.port';
import { ORGANIZATION_AUTH } from '../../organizations.di-tokens';
import { CheckSlugQuery } from './check-slug.query';

@QueryHandler(CheckSlugQuery)
export class CheckSlugQueryHandler
  implements IQueryHandler<CheckSlugQuery, SlugAvailabilityResponseDto>
{
  constructor(
    @Inject(ORGANIZATION_AUTH)
    private readonly organizations: OrganizationAuthPort,
  ) {}

  async execute(query: CheckSlugQuery): Promise<SlugAvailabilityResponseDto> {
    return { available: await this.organizations.isSlugAvailable(query.headers, query.slug) };
  }
}
