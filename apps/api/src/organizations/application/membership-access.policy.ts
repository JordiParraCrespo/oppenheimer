import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SessionCachePort } from '../../auth/application/session-cache.port';
import { SESSION_CACHE } from '../../auth/auth.di-tokens';
import { missingSystemRole } from '../../roles/application/missing-system-role.factory';
import type { RoleRepositoryPort } from '../../roles/database/role.repository.port';
import type { UserRoleRepositoryPort } from '../../roles/database/user-role.repository.port';
import { ROLE_REPOSITORY, USER_ROLE_REPOSITORY } from '../../roles/roles.di-tokens';
import type { OrganizationAccessRepositoryPort } from '../database/organization-access.repository.port';
import { applicationRoleFor } from '../domain/application-role.policy';
import { ORGANIZATION_ACCESS } from '../organizations.di-tokens';

/** A membership as Better Auth wrote it: who, where, in which organization role. */
export interface RosterEntry {
  userId: string;
  organizationId: string;
  role: string;
}

/**
 * Keeps what the app lets a person do in an organization aligned with Better
 * Auth's roster of it. Memberships live in Better Auth, route permissions in
 * CASL roles, and no transaction spans the two stores, so neither half is left
 * standing alone: a roster write whose application role cannot be written is
 * undone, and ending a membership takes everything the organization gave in
 * one transaction.
 */
@Injectable()
export class MembershipAccessPolicy {
  private readonly logger = new Logger(MembershipAccessPolicy.name);

  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roles: RoleRepositoryPort,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoles: UserRoleRepositoryPort,
    @Inject(ORGANIZATION_ACCESS)
    private readonly access: OrganizationAccessRepositoryPort,
    @Inject(SESSION_CACHE)
    private readonly sessionCache: SessionCachePort,
  ) {}

  /**
   * Make a roster change and the application role that goes with it, or
   * neither. `write` is Better Auth's roster write; if the role that opens the
   * organization cannot be granted after it (the system role is missing, the
   * store failed), `undo` reverts the roster and the original error is raised.
   * Every Better Auth door into an organization goes through here: creating it,
   * adding a member, accepting an invitation. A role change is {@link reassign}.
   */
  async admit<Entry extends RosterEntry>(
    write: () => Promise<Entry>,
    undo: (entry: Entry) => Promise<unknown>,
  ): Promise<Entry> {
    const entry = await write();
    await this.compensating(
      () => this.grant(entry),
      () => undo(entry),
      'Could not undo a roster change whose application role failed',
      entry,
    );
    return entry;
  }

  /**
   * Change a member's organization role and the application role that stands
   * for it, or neither, in the opposite order to {@link admit}. The new
   * application role is granted first and Better Auth's write follows; if that
   * write is refused, the application roles the member held in this
   * organization before are put back. Undoing Better Auth's write instead
   * would need the caller's permission to change roles, which a caller
   * demoting themselves has just given up; putting back rows in the app's own
   * store needs none.
   */
  async reassign<T>(entry: RosterEntry, write: () => Promise<T>): Promise<T> {
    const before = await this.userRoles.findScopedRoleIds(entry.userId, entry.organizationId);
    await this.grant(entry);
    return this.compensating(
      write,
      () => this.userRoles.setRolesForUser(entry.userId, before, entry.organizationId),
      'Could not restore the application roles of a refused role change',
      entry,
    );
  }

  /**
   * Everything the organization gave `userId` — their roles, access grants
   * and a session still acting in it — taken in one transaction after Better
   * Auth removes the membership, then Better Auth's cached copies of those
   * sessions refreshed, since the rows were written behind its back.
   */
  async revoke(userId: string, organizationId: string): Promise<void> {
    await this.access.revokeFor(userId, organizationId);
    await this.sessionCache.refreshUser(userId);
  }

  /**
   * The org-scoped application role the organization role stands for. Only
   * that role (`owner` or `user`) is swapped; custom roles an admin assigned
   * in this organization are the member's too, and a roster change must not
   * take them away.
   */
  private async grant({ userId, organizationId, role }: RosterEntry): Promise<void> {
    const roleName = applicationRoleFor(role);
    const found = await this.roles.findOneByName(roleName, null);
    if (found.isNone()) throw missingSystemRole(roleName);
    await this.userRoles.replaceMembershipRole(userId, organizationId, found.unwrap().id);
  }

  /**
   * Run `action`; when it fails, run `cleanup` and raise the action's own error.
   * The caller must see why they were refused, not an error about the
   * cleanup; a cleanup that fails is logged with the half-changed membership
   * it leaves.
   */
  private async compensating<T>(
    action: () => Promise<T>,
    cleanup: () => Promise<unknown>,
    message: string,
    entry: RosterEntry,
  ): Promise<T> {
    try {
      return await action();
    } catch (error) {
      try {
        await cleanup();
      } catch (cleanupError) {
        this.logger.error(
          { message, userId: entry.userId, organizationId: entry.organizationId },
          cleanupError instanceof Error ? cleanupError.stack : String(cleanupError),
        );
      }
      throw error;
    }
  }
}
