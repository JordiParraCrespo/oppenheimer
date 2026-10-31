import { Inject, Injectable } from '@nestjs/common';
import { type ScopeResolverPort } from '../../authz/application/scope-resolver.port';
import { SCOPE_RESOLVER } from '../../authz/authz.di-tokens';
import { type AccessScope } from '../../authz/domain/access-scope.types';
import type { WorkspaceLookupPort } from '../../organizations/application/workspace-lookup.port';
import { WORKSPACE_LOOKUP } from '../../organizations/organizations.di-tokens';

/**
 * The scope a bot acts in (`25-bots.md` §4): its owner's, in the bot's
 * workspace, resolved fresh each time and never cached. Two rules, held
 * here once for every caller (a turn's context, its tools, an approval
 * being decided): the owner must still be a member of the workspace, and
 * the scope is never elevated (no platform tier, no full-access bypass),
 * so a bot can do exactly what its owner can now and nothing once they
 * leave.
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
