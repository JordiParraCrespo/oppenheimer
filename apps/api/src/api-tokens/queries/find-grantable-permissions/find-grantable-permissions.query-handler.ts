import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { grantableScopes, type Scope } from '@oppenheimer/shared';
import { AbilityFactory } from '../../../roles/services/ability.factory';
import { FindGrantablePermissionsQuery } from './find-grantable-permissions.query';

@QueryHandler(FindGrantablePermissionsQuery)
export class FindGrantablePermissionsQueryHandler
  implements IQueryHandler<FindGrantablePermissionsQuery, Scope[]>
{
  constructor(private readonly abilityFactory: AbilityFactory) {}

  async execute(query: FindGrantablePermissionsQuery): Promise<Scope[]> {
    const ability = await this.abilityFactory.createForUser(
      { id: query.userId, role: query.role },
      { activeOrganizationId: query.activeOrganizationId ?? null },
    );
    return grantableScopes(ability);
  }
}
