import { Inject, Injectable } from '@nestjs/common';
import {
  type AccessScope,
  SCOPE_RESOLVER,
  type ScopeResolverPort,
} from '@oppenheimer/backend-authz';
import type { WorkspaceLookupPort } from '../../organizations/application/workspace-lookup.port';
import { WORKSPACE_LOOKUP } from '../../organizations/organizations.di-tokens';

/**
 * The scope a run acts in (§Q5): the automation's owner, in the automation's
 * workspace, resolved fresh at every dispatch — never cached, never a bot. A
 * run is exactly as capable as its owner is *now*: an owner who left the
 * workspace, or lost the host, gets nothing started in their name.
 */
@Injectable()
export class OwnerScopeResolver {
  constructor(
    @Inject(SCOPE_RESOLVER)
    private readonly scopes: ScopeResolverPort,
    @Inject(WORKSPACE_LOOKUP)
    private readonly workspaces: WorkspaceLookupPort,
  ) {}

  /** The owner's scope, or null when they are no longer a member of the workspace. */
  async resolve(organizationId: string, ownerUserId: string): Promise<AccessScope | null> {
    if (!(await this.workspaces.isMember(organizationId, ownerUserId))) return null;
    return this.scopes.resolve({
      userId: ownerUserId,
      organizationId,
      isPlatformAdmin: false,
      hasFullAccess: false,
    });
  }
}
