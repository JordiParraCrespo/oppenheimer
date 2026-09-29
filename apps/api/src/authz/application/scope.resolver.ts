import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AccessScope, ResolveScopeInput, ScopeResolverPort } from '@oppenheimer/backend-authz';
import type { Repository } from 'typeorm';
import { TeamOrmEntity } from '../../organizations/database/team.orm-entity';
import { TeamMemberOrmEntity } from '../../organizations/database/team-member.orm-entity';
import type { UserRoleRepositoryPort } from '../../roles/database/user-role.repository.port';
import { USER_ROLE_REPOSITORY } from '../../roles/roles.di-tokens';
import { ACCESS_GRANT_REPOSITORY } from '../authz.di-tokens';
import type { AccessGrantRepositoryPort } from '../database/access-grant.repository.port';

/**
 * Everything is resolved in **one organization**, `input.organizationId`,
 * which `AccessScopeInterceptor` fills from the request's tenant — the same
 * organization `PoliciesGuard` built the caller's ability in (on an
 * `@OrganizationScoped` route, the one the path names). Teams, roles and grants
 * are all read in it, so the scope and the ability never describe two
 * different tenants.
 *
 * Composes two sources:
 *
 * 1. **Structural** — the teams the caller belongs to in that organization.
 *    No new tables: `teamMember` joined to `team`, in one query.
 * 2. **Explicit** — unexpired `access_grant` rows in that organization
 *    addressed to the caller directly, to one of their teams or to a role they
 *    hold there (global, or scoped to that organization), read through the
 *    aggregate's port.
 *
 * **Nothing here is cached.** Team membership is written by Better Auth
 * (`auth.api.addTeamMember` / `removeTeamMember`) outside any application
 * transaction, so it stages nothing on the outbox and there is no event to
 * invalidate on: a cached `teamIds` would keep granting a removed member that
 * team's rows. Two indexed queries against rows already hot in the pool are
 * cheaper than that bug. `access_grant` is read fresh too.
 *
 * The caller's **role ids** normally arrive in `input.roleIds`:
 * `AccessScopeInterceptor` takes them from `AbilityFactory`, which resolved
 * them for the ability — from its Redis cache, keyed on the organization's
 * `roleVersion`, the global role catalog's version and the user's, all bumped
 * in the same transaction as the writes the application owns. Without them
 * (another caller of the port), `user_role` is read here.
 */
@Injectable()
export class ScopeResolver implements ScopeResolverPort {
  constructor(
    @InjectRepository(TeamMemberOrmEntity)
    private readonly teamMembers: Repository<TeamMemberOrmEntity>,
    @Inject(ACCESS_GRANT_REPOSITORY)
    private readonly grants: AccessGrantRepositoryPort,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoles: UserRoleRepositoryPort,
  ) {}

  async resolve(input: ResolveScopeInput): Promise<AccessScope> {
    const bypass = input.isPlatformAdmin || input.hasFullAccess;

    // A bypass scope reaches everything, so resolving its membership would be
    // work whose result is discarded.
    if (bypass) {
      return {
        userId: input.userId,
        organizationId: input.organizationId,
        teamIds: [],
        grants: new Map(),
        bypass: true,
      };
    }

    if (!input.organizationId) {
      return {
        userId: input.userId,
        organizationId: null,
        teamIds: [],
        grants: new Map(),
        bypass: false,
      };
    }

    const [teamIds, roleIds] = await Promise.all([
      this.teamIdsFor(input.userId, input.organizationId),
      input.roleIds ?? this.userRoles.findRoleIdsForUser(input.userId, input.organizationId),
    ]);
    const grants = await this.grantsFor(input.userId, teamIds, roleIds, input.organizationId);

    return {
      userId: input.userId,
      organizationId: input.organizationId,
      teamIds,
      grants,
      bypass: false,
    };
  }

  /**
   * Teams the user belongs to, narrowed to the organization. `teamMember`
   * carries no organization, so the tenant filter has to come from `team`:
   * skipping the join would leak a team id across tenants.
   */
  private async teamIdsFor(userId: string, organizationId: string): Promise<string[]> {
    const rows = await this.teamMembers
      .createQueryBuilder('tm')
      .innerJoin(TeamOrmEntity, 't', 't.id = tm.teamId')
      .where('tm.userId = :userId', { userId })
      .andWhere('t.organizationId = :organizationId', { organizationId })
      .select('tm.teamId', 'teamId')
      .getRawMany<{ teamId: string }>();
    return rows.map((row) => row.teamId);
  }

  /**
   * Unexpired grants addressed to the caller, one of their teams or one of
   * their roles, folded into a per-subject map. A blanket grant collapses the
   * whole subject to `'all'`.
   */
  private async grantsFor(
    userId: string,
    teamIds: readonly string[],
    roleIds: readonly string[],
    organizationId: string,
  ): Promise<Map<string, Set<string> | 'all'>> {
    const rows = await this.grants.findActiveForPrincipals(organizationId, [
      { principalType: 'user', principalId: userId },
      ...teamIds.map((teamId) => ({
        principalType: 'team',
        principalId: teamId,
      })),
      ...roleIds.map((roleId) => ({
        principalType: 'role',
        principalId: roleId,
      })),
    ]);

    const grants = new Map<string, Set<string> | 'all'>();
    for (const row of rows) {
      if (row.isBlanket()) {
        grants.set(row.resourceType, 'all');
        continue;
      }
      const existing = grants.get(row.resourceType);
      if (existing === 'all') continue;
      // `isBlanket()` is false here, so resourceId is present.
      const resourceId = row.resourceId as string;
      if (existing) existing.add(resourceId);
      else grants.set(row.resourceType, new Set([resourceId]));
    }
    return grants;
  }
}
