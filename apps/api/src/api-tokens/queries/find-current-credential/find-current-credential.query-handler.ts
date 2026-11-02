import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { expandScopes, grantableScopes, type Scope, sortScopes } from '@oppenheimer/shared';
import { AbilityFactory } from '../../../roles/application/ability.factory';
import { FindCurrentCredentialQuery } from './find-current-credential.query';

export interface CurrentCredentialScopes {
  grantedScopes: Scope[] | null;
  effectiveScopes: Scope[];
}

/**
 * A scope is effective only if the credential carries it *and* the owner's
 * roles still permit it, so revoking a role immediately narrows the answer.
 */
@QueryHandler(FindCurrentCredentialQuery)
export class FindCurrentCredentialQueryHandler
  implements IQueryHandler<FindCurrentCredentialQuery, CurrentCredentialScopes>
{
  constructor(private readonly abilityFactory: AbilityFactory) {}

  async execute(query: FindCurrentCredentialQuery): Promise<CurrentCredentialScopes> {
    const ability = await this.abilityFactory.createForUser(
      { id: query.userId, role: query.role },
      { organizationId: query.organizationId ?? null },
    );

    const permitted = grantableScopes(ability);

    // A browser session carries no scope restriction: everything its owner's
    // roles allow is in effect.
    if (!query.grantedScopes) {
      return { grantedScopes: null, effectiveScopes: permitted };
    }

    const granted = expandScopes(query.grantedScopes);
    return {
      grantedScopes: sortScopes(query.grantedScopes),
      effectiveScopes: permitted.filter((scope) => granted.has(scope)),
    };
  }
}
