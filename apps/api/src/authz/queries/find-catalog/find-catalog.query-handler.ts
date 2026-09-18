import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ResourceRegistry } from '@oppenheimer/backend-authz';
import { AbilityFactory } from '../../../roles/application/ability.factory';
import { toCatalogResponse } from '../../authz.mapper';
import type { AuthzCatalogResponseDto } from '../../dtos/authz-catalog.response.dto';
import { FindAuthzCatalogQuery } from './find-catalog.query';

@QueryHandler(FindAuthzCatalogQuery)
export class FindAuthzCatalogQueryHandler
  implements IQueryHandler<FindAuthzCatalogQuery, AuthzCatalogResponseDto>
{
  constructor(
    private readonly registry: ResourceRegistry,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async execute(query: FindAuthzCatalogQuery): Promise<AuthzCatalogResponseDto> {
    const ability = await this.abilityFactory.createForUser(
      { id: query.userId, role: query.role },
      { activeOrganizationId: query.activeOrganizationId ?? null },
    );

    return toCatalogResponse(this.registry, ability);
  }
}
