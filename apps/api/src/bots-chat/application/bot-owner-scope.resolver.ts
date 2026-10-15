import { Inject, Injectable } from '@nestjs/common';
import {
  type AccessScope,
  SCOPE_RESOLVER,
  type ScopeResolverPort,
} from '@oppenheimer/backend-authz';
import type { WorkspaceLookupPort } from '../../organizations/application/workspace-lookup.port';
import { WORKSPACE_LOOKUP } from '../../organizations/organizations.di-tokens';

/**
 * The scope a bot's turn acts in (`25-bots.md` §4): its owner's, in the
 * bot's workspace, resolved fresh for every turn and never cached. A bot can
 * see and do exactly what its owner can now: an owner who left the
 * workspace leaves it nothing to act through.
 */
@Injectable()
export class BotOwnerScopeResolver {
  constructor(
    @Inject(SCOPE_RESOLVER) private readonly scopes: ScopeResolverPort,
    @Inject(WORKSPACE_LOOKUP) private readonly workspaces: WorkspaceLookupPort,
  ) {}

  /** The owner's scope, or null when the bot has no owner or they are no longer a member. */
  async resolve(organizationId: string, ownerUserId: string | null): Promise<AccessScope | null> {
    if (!ownerUserId) return null;
    if (!(await this.workspaces.isMember(organizationId, ownerUserId))) return null;
    return this.scopes.resolve({
      userId: ownerUserId,
      organizationId,
      isPlatformAdmin: false,
      hasFullAccess: false,
    });
  }
}
