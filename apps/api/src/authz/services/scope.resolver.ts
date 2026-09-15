import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AccessScope, ResolveScopeInput, ScopeResolverPort } from '@oppenheimer/backend-authz';
import { In, type Repository } from 'typeorm';
import { TeamOrmEntity } from '../../organizations/database/team.orm-entity';
import { TeamMemberOrmEntity } from '../../organizations/database/team-member.orm-entity';
import { ACCESS_GRANT_REPOSITORY } from '../authz.di-tokens';
import type { AccessGrantRepositoryPort } from '../database/access-grant.repository.port';

/**
 * The application's default scope resolver.
 *
 * Composes two sources:
 *
 * 1. **Structural** — the teams the caller belongs to inside the active
 *    organization. No new tables: `teamMember` joined to `team`.
 * 2. **Explicit** — unexpired `access_grant` rows addressed to the caller
 *    directly or to one of their teams, read through the aggregate's port.
 *
 * **Nothing here is cached.** Team membership is written by Better Auth
 * (`auth.api.addTeamMember` / `removeTeamMember`) outside any application
 * transaction, so it stages nothing on the outbox and there is no event to
 * invalidate on: a cached `teamIds` would keep granting a removed member that
 * team's rows. Two indexed lookups against rows already hot in the pool are
 * cheaper than that bug. Role *rules* are cached separately, keyed on
 * `organization.roleVersion`, because those the application does own.
 */
@Injectable()
export class ScopeResolver implements ScopeResolverPort {
  constructor(
    @InjectRepository(TeamMemberOrmEntity)
    private readonly teamMembers: Repository<TeamMemberOrmEntity>,
    @InjectRepository(TeamOrmEntity)
    private readonly teams: Repository<TeamOrmEntity>,
    @Inject(ACCESS_GRANT_REPOSITORY)
    private readonly grants: AccessGrantRepositoryPort,
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

    const teamIds = await this.teamIdsFor(input.userId, input.organizationId);
    const grants = await this.grantsFor(input.userId, teamIds, input.organizationId);

    return {
      userId: input.userId,
      organizationId: input.organizationId,
      teamIds,
      grants,
      bypass: false,
    };
  }

  /** Teams the user belongs to, narrowed to the active organization. */
  private async teamIdsFor(userId: string, organizationId: string): Promise<string[]> {
    const memberships = await this.teamMembers.find({
      where: { userId },
      select: { teamId: true },
    });
    if (memberships.length === 0) return [];

    // `teamMember` carries no organization, so the tenant filter has to come
    // from `team`. Skipping this join would leak a team id across tenants.
    const teams = await this.teams.find({
      where: {
        id: In(memberships.map((membership) => membership.teamId)),
        organizationId,
      },
      select: { id: true },
    });
    return teams.map((team) => team.id);
  }

  /**
   * Unexpired grants addressed to the caller or to one of their teams, folded
   * into a per-subject map. A blanket grant collapses the whole subject to
   * `'all'`.
   */
  private async grantsFor(
    userId: string,
    teamIds: readonly string[],
    organizationId: string,
  ): Promise<Map<string, Set<string> | 'all'>> {
    const rows = await this.grants.findActiveForPrincipals(organizationId, [
      { principalType: 'user', principalId: userId },
      ...teamIds.map((teamId) => ({
        principalType: 'team',
        principalId: teamId,
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
