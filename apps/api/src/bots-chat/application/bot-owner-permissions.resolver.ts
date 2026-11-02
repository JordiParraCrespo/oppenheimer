import { Injectable } from '@nestjs/common';
import { expandScopes, grantableScopes, ROLES, type Scope } from '@oppenheimer/shared';
import { AbilityFactory } from '../../authz/application/ability.factory';
import type { AccessScope } from '../../authz/domain/access-scope.types';

/**
 * What a bot's owner may do now, as scopes (`25-bots.md` §4): the scopes
 * their live roles in the bot's workspace would let them grant a token,
 * `grantableScopes` as API tokens use it, so a bot reaches no further than a
 * token its owner could mint. Built fresh for every turn and every approved
 * call, never cached past the ability's own cache, so a role removed while a
 * card waits stops the call. The platform tier is left out on purpose, as the
 * owner's scope leaves it out (`BotOwnerScopeResolver`): the account's
 * `user` role, never `admin`.
 */
@Injectable()
export class BotOwnerPermissionsResolver {
  constructor(private readonly abilities: AbilityFactory) {}

  async heldScopes(owner: AccessScope): Promise<ReadonlySet<Scope>> {
    const ability = await this.abilities.createForUser(
      { id: owner.userId, role: ROLES.USER },
      { organizationId: owner.organizationId },
    );
    return expandScopes(grantableScopes(ability));
  }
}
