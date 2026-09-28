import { Inject, Injectable } from '@nestjs/common';
import type { SessionCachePort } from '../../auth/application/session-cache.port';
import { SESSION_CACHE } from '../../auth/auth.di-tokens';
import { missingSystemRole } from '../../roles/application/missing-system-role.factory';
import type { RoleRepositoryPort } from '../../roles/database/role.repository.port';
import type { UserRoleRepositoryPort } from '../../roles/database/user-role.repository.port';
import { ROLE_REPOSITORY, USER_ROLE_REPOSITORY } from '../../roles/roles.di-tokens';
import type { OrganizationAccessRepositoryPort } from '../database/organization-access.repository.port';
import { applicationRoleFor } from '../domain/application-role.policy';
import { ORGANIZATION_ACCESS } from '../organizations.di-tokens';

/**
 * Keeps what the app lets a person do in an organization aligned with Better
 * Auth's roster of it.
 *
 * Better Auth owns memberships and their organization roles; CASL owns what
 * the app's routes allow. Every path that creates or changes a membership —
 * creating an organization, adding a member, changing their role, accepting an
 * invitation — grants the application role that goes with it, and every path
 * that ends one revokes everything the organization gave them. Doing it at the
 * moment the membership changes is what makes "you are in this organization"
 * and "you may work in it" one fact rather than two that disagree.
 */
@Injectable()
export class MembershipAccessPolicy {
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
   * Give `userId` the org-scoped application role their organization role
   * stands for. Only that role (`owner` or `user`) is swapped; custom roles an
   * admin assigned in this organization are the member's too, and a roster
   * change must not take them away.
   */
  async grant(userId: string, organizationId: string, organizationRole: string): Promise<void> {
    const roleName = applicationRoleFor(organizationRole);
    const role = await this.roles.findOneByName(roleName, null);
    if (role.isNone()) throw missingSystemRole(roleName);
    await this.userRoles.replaceMembershipRole(userId, organizationId, role.unwrap().id);
  }

  /**
   * Revoke every organization-local access path after Better Auth removes the
   * membership. The role assignment is the authorization boundary; clearing
   * grants and stale session selection prevents the removed person from still
   * appearing or acting inside the organization through secondary tables.
   */
  async revoke(userId: string, organizationId: string): Promise<void> {
    await this.userRoles.setRolesForUser(userId, [], organizationId);
    await this.access.revokeFor(userId, organizationId);
    // Written behind Better Auth's back, so its cached copies of these
    // sessions still name the organization; without this the removed member
    // keeps acting in it until the session expires.
    await this.sessionCache.refreshUser(userId);
  }
}
