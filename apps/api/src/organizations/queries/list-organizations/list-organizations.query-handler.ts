import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { isOrganizationAllowed } from '@oppenheimer/shared';
import type { OrganizationResponseDto } from '../../dtos/organization.response.dto';
import type { OrganizationAuthPort } from '../../infrastructure/organization-auth.port';
import { ORGANIZATION_AUTH } from '../../organizations.di-tokens';
import { ListOrganizationsQuery } from './list-organizations.query';

/**
 * The organizations the caller belongs to, with the session's selected one
 * first and anything the credential is not allowed to see left out.
 */
@QueryHandler(ListOrganizationsQuery)
export class ListOrganizationsQueryHandler
  implements IQueryHandler<ListOrganizationsQuery, OrganizationResponseDto[]>
{
  constructor(
    @Inject(ORGANIZATION_AUTH)
    private readonly organizations: OrganizationAuthPort,
  ) {}

  async execute(query: ListOrganizationsQuery): Promise<OrganizationResponseDto[]> {
    // A collection route names no organization for `ScopesGuard` to check, so
    // a token pinned to one organization would otherwise see every one its
    // owner belongs to. The credential's restriction is applied row by row.
    const organizations = (await this.organizations.list(query.headers)).filter((organization) =>
      isOrganizationAllowed(query.resourceScope, organization.id),
    );
    const active = query.activeOrganizationId;
    if (!active) return organizations;

    // Consumers that do not render an organization switcher use the first
    // item. Put the session's selected organization there instead of relying
    // on Better Auth's membership creation order (an invited user also owns an
    // automatically provisioned personal organization).
    return [...organizations].sort((left, right) =>
      left.id === active ? -1 : right.id === active ? 1 : 0,
    );
  }
}
