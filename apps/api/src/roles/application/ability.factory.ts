import { Inject, Injectable } from '@nestjs/common';
import {
  type AppAbility,
  defineAbilitiesFromPermissions,
  type PermissionDefinition,
  SYSTEM_ROLE_PERMISSIONS,
} from '@oppenheimer/shared';
import type { AbilityPort } from '../../auth/application/ability.port';
import type { RoleRepositoryPort } from '../database/role.repository.port';
import type { UserRoleRepositoryPort } from '../database/user-role.repository.port';
import { ROLE_REPOSITORY, USER_ROLE_REPOSITORY } from '../roles.di-tokens';

/** Minimal shape of the authenticated principal the guard hands to the factory. */
export interface AuthenticatedUser {
  id?: string;
  /** Legacy single-role column, used as a fallback before migration. */
  role?: string;
  [key: string]: unknown;
}

/** Where the per-request ability is memoized. */
const ABILITY_CACHE = Symbol('authz.ability');

/** The subset of the request object the factory reads and writes. */
export interface AbilityRequest {
  user?: AuthenticatedUser;
  session?: {
    activeOrganizationId?: string | null;
    activeTeamId?: string | null;
  } | null;
  ability?: AppAbility;
  [ABILITY_CACHE]?: AppAbility;
}

/** Request-scoped context used to interpolate resource-scoping conditions. */
export interface AbilityScope {
  /** The caller's active organization (from `session.activeOrganizationId`). */
  activeOrganizationId?: string | null;
  /** The caller's active workspace/team (from `session.activeTeamId`). */
  activeTeamId?: string | null;
}

/**
 * Builds a CASL ability for an authenticated user from the union of every role
 * assigned to them. This replaces the old hardcoded `defineAbilitiesFor(role)`
 * switch: permissions now live in the database and are fully admin-managed.
 *
 * Resolution order:
 *   1. Roles assigned through the `user_role` join (dynamic RBAC).
 *   2. Fallback to the legacy `user.role` column — first the DB role of that
 *      name, then the seeded system-role permissions — so users that predate
 *      the join keep working.
 */
@Injectable()
export class AbilityFactory implements AbilityPort {
  constructor(
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoleRepository: UserRoleRepositoryPort,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepositoryPort,
  ) {}

  /**
   * The caller's ability for this request, built once and memoized on the
   * request object.
   *
   * Four call sites resolve the ability during a single request (the guard plus
   * three api-token handlers). Without the memo each one re-reads the role
   * tables, so the same answer is computed up to four times per request.
   */
  async forRequest(request: AbilityRequest): Promise<AppAbility> {
    if (request[ABILITY_CACHE]) return request[ABILITY_CACHE];

    const ability = await this.createForUser(request.user ?? {}, {
      activeOrganizationId: request.session?.activeOrganizationId ?? null,
      activeTeamId: request.session?.activeTeamId ?? null,
    });

    request[ABILITY_CACHE] = ability;
    request.ability = ability;
    return ability;
  }

  /**
   * The caller's effective permission definitions — the same union
   * {@link createForUser} builds an ability from, but returned raw so a client
   * can rebuild the ability itself (the web app gates its sidebar on this).
   */
  async permissionsForUser(
    user: AuthenticatedUser,
    scope: AbilityScope = {},
  ): Promise<PermissionDefinition[]> {
    return this.resolvePermissions(user, scope.activeOrganizationId ?? null);
  }

  async createForUser(user: AuthenticatedUser, scope: AbilityScope = {}): Promise<AppAbility> {
    const permissions = await this.resolvePermissions(user, scope.activeOrganizationId ?? null);
    // Pass the principal and active-org scope so resource-scoping conditions
    // (e.g. `${user.id}`, `${activeOrganizationId}`) can be interpolated when
    // the ability is built.
    return defineAbilitiesFromPermissions(permissions, {
      user,
      activeOrganizationId: scope.activeOrganizationId ?? null,
      activeTeamId: scope.activeTeamId ?? null,
    });
  }

  private async resolvePermissions(
    user: AuthenticatedUser,
    activeOrganizationId: string | null,
  ): Promise<PermissionDefinition[]> {
    const permissions: PermissionDefinition[] = [];

    // 1. Roles assigned through the `user_role` join (dynamic RBAC), narrowed
    //    to the active organization. The repository unions the caller's global
    //    assignments with the ones scoped to that organization, so a role
    //    granted in one tenant has no effect in another.
    if (user.id) {
      const roles = await this.userRoleRepository.findRolesForUser(user.id, activeOrganizationId);
      for (const role of roles) {
        permissions.push(...role.permissions.map((permission) => permission.toDefinition()));
      }
    }

    // 2. Also honour the Better Auth `user.role` column. The admin plugin's
    //    `set-role` writes this column, so unioning it here (not just as a
    //    fallback) keeps admin-plugin promotions in sync with CASL: a user
    //    promoted to `admin`/`superadmin` gains that role's permissions even
    //    though their `user_role` join still holds the default `user` row.
    if (user.role) {
      // Better Auth stores multiple platform roles as a comma-separated value.
      // Resolve each name independently so `user,admin` receives the same
      // control-plane permissions as a single `admin` role.
      const platformRoles = user.role
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean);

      for (const roleName of platformRoles) {
        const found = await this.roleRepository.findOneByName(roleName);
        permissions.push(
          ...(found.isSome()
            ? found.unwrap().permissions.map((permission) => permission.toDefinition())
            : (SYSTEM_ROLE_PERMISSIONS[roleName] ?? [])),
        );
      }
    }

    return permissions;
  }
}
