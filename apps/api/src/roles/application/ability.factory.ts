import { Inject, Injectable, Logger } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import { requestMemo } from '@oppenheimer/backend-core';
import {
  type AppAbility,
  defineAbilitiesFromPermissions,
  type PermissionDefinition,
  SYSTEM_ROLE_PERMISSIONS,
} from '@oppenheimer/shared';
import type { AbilityPort } from '../../auth/application/ability.port';
import { type TenantRequest, tenantOrganizationIdOf } from '../../auth/domain/request-tenant.types';
import type {
  AuthzVersionRepositoryPort,
  AuthzVersions,
} from '../database/authz-version.repository.port';
import type { UserRoleRepositoryPort } from '../database/user-role.repository.port';
import { AUTHZ_VERSION_REPOSITORY, USER_ROLE_REPOSITORY } from '../roles.di-tokens';
import { GlobalRoleRegistry } from './global-role.registry';

/** Minimal shape of the authenticated principal the guard hands to the factory. */
export interface AuthenticatedUser {
  id?: string;
  /** Legacy single-role column, used as a fallback before migration. */
  role?: string;
  [key: string]: unknown;
}

/** `requestMemo` keys: the resolved role set, and the ability built from it. */
const ROLE_SET = Symbol('authz.roleSet');
const ABILITY = Symbol('authz.ability');

/** How long a cached role set lives. The versions make it correct; this only bounds memory. */
const ROLE_SET_TTL_SECONDS = 900;

/** The subset of the request object the factory reads and writes. */
export interface AbilityRequest extends TenantRequest {
  user?: AuthenticatedUser;
  session?: {
    activeTeamId?: string | null;
  } | null;
  ability?: AppAbility;
}

/** Request-scoped context used to interpolate resource-scoping conditions. */
export interface AbilityScope {
  /**
   * The organization the ability is built in: the caller's roles scoped to it
   * count, and the `${activeOrganizationId}` condition placeholder resolves to
   * it. For a request, its tenant.
   */
  organizationId?: string | null;
  /** The caller's active workspace/team (from `session.activeTeamId`). */
  activeTeamId?: string | null;
}

/**
 * The roles a user holds in one organization and what they grant: the value a
 * request's ability is built from, and — for the `user_role` half — what the
 * Redis cache holds.
 */
interface RoleSet {
  /**
   * Ids of the `user_role`-assigned roles (global assignments plus those
   * scoped to the organization), for the access-scope resolver's
   * role-addressed grants.
   */
  roleIds: string[];
  permissions: PermissionDefinition[];
}

/**
 * Builds a CASL ability for an authenticated user from the union of every role
 * assigned to them.
 *
 * Resolution order:
 *   1. Roles assigned through the `user_role` join (dynamic RBAC).
 *   2. The Better Auth `user.role` column — first the global role of that
 *      name, then the seeded system-role permissions — so users that predate
 *      the join keep working.
 *
 * **What is cached, and on what.** Every resolution first reads three version
 * counters in one query (`AuthzVersionRepositoryPort`): the organization's
 * `roleVersion`, the global role catalog's and the user's own. Every writer
 * that changes effective permissions bumps one of them in its own transaction.
 *
 * - The `user_role`-derived permissions are cached in Redis under a key that
 *   carries all three, so a write is a miss on the very next request, on
 *   every replica. The versions are read **before** the cache and before any
 *   computation: a value computed after a concurrent write is newer than its
 *   key says, which is harmless, whereas one computed before reading the
 *   versions could be stored under a key that claims to be current.
 * - The platform roles on `user.role` come from `GlobalRoleRegistry`, this
 *   process's snapshot of the global roles, reloaded when the catalog version
 *   moves. They are not part of the cached value: `user.role` arrives fresh
 *   with every request, so Better Auth's `set-role` needs no invalidation.
 * - Redis failing is not an authorization failure: a cache error falls back
 *   to the database, logged once per outage.
 *
 * The ability itself is never cached across requests — it is interpolated
 * per request (`${user.id}`, `${activeOrganizationId}`) and does not
 * serialize — only the permission definitions it is built from.
 */
@Injectable()
export class AbilityFactory implements AbilityPort {
  private readonly logger = new Logger('AbilityFactory');
  private cacheFailing = false;

  constructor(
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoleRepository: UserRoleRepositoryPort,
    @Inject(AUTHZ_VERSION_REPOSITORY)
    private readonly versions: AuthzVersionRepositoryPort,
    private readonly globalRoles: GlobalRoleRegistry,
    private readonly cache: CacheService,
  ) {}

  /**
   * The caller's ability for this request, built in the request's tenant and
   * memoized per request.
   *
   * `PoliciesGuard` and `AccessScopeInterceptor` both ask for it; the memo
   * makes the second ask free, and concurrent asks share one resolution. The
   * api-token, catalog and role-grant handlers call {@link createForUser}
   * instead, which has no request to memoize on but shares the Redis cache.
   *
   * The organization comes from the request (`request.tenant`, write-once),
   * never from an argument the memo could not see, so every caller in a
   * request asks about the same organization.
   */
  forRequest(request: AbilityRequest): Promise<AppAbility> {
    return requestMemo(request, ABILITY, async () => {
      const { permissions } = await this.roleSetFor(request);
      const ability = this.build(permissions, request.user ?? {}, {
        organizationId: tenantOrganizationIdOf(request),
        activeTeamId: request.session?.activeTeamId ?? null,
      });
      request.ability = ability;
      return ability;
    });
  }

  /**
   * The ids of the roles the caller holds in the request's tenant (global
   * assignments plus those scoped to it) — the same read the ability came
   * from, so the access-scope resolver need not query `user_role` again.
   */
  async roleIdsForRequest(request: AbilityRequest): Promise<string[]> {
    return (await this.roleSetFor(request)).roleIds;
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
    return (await this.resolve(user, scope.organizationId ?? null)).permissions;
  }

  async createForUser(user: AuthenticatedUser, scope: AbilityScope = {}): Promise<AppAbility> {
    const { permissions } = await this.resolve(user, scope.organizationId ?? null);
    return this.build(permissions, user, scope);
  }

  private build(
    permissions: PermissionDefinition[],
    user: AuthenticatedUser,
    scope: AbilityScope,
  ): AppAbility {
    // `${activeOrganizationId}` keeps its name because role rows store it (the
    // `owner` role's seed in `InitialSchema`); what it resolves to is the
    // organization this ability is built in.
    return defineAbilitiesFromPermissions(permissions, {
      user,
      activeOrganizationId: scope.organizationId ?? null,
      activeTeamId: scope.activeTeamId ?? null,
    });
  }

  private roleSetFor(request: AbilityRequest): Promise<RoleSet> {
    return requestMemo(request, ROLE_SET, () =>
      this.resolve(request.user ?? {}, tenantOrganizationIdOf(request)),
    );
  }

  private async resolve(user: AuthenticatedUser, organizationId: string | null): Promise<RoleSet> {
    // First, always: every read below is keyed on these.
    const versions = await this.versions.read(user.id ?? null, organizationId);

    const [assigned, platform] = await Promise.all([
      user.id
        ? this.assignedRoles(user.id, organizationId, versions)
        : Promise.resolve<RoleSet>({ roleIds: [], permissions: [] }),
      this.platformPermissions(user.role, versions.catalog),
    ]);

    return {
      roleIds: assigned.roleIds,
      permissions: [...assigned.permissions, ...platform],
    };
  }

  /**
   * Roles assigned through the `user_role` join (dynamic RBAC), narrowed to
   * the organization. The repository unions the caller's global assignments
   * with the ones scoped to that organization, so a role granted in one tenant
   * has no effect in another.
   */
  private async assignedRoles(
    userId: string,
    organizationId: string | null,
    versions: AuthzVersions,
  ): Promise<RoleSet> {
    const key = [
      'authz:roles:v1',
      userId,
      organizationId ?? '-',
      versions.organization ?? '-',
      versions.catalog,
      versions.user,
    ].join(':');

    // Not `CacheService.getOrSet`: it fails open silently, and this read must
    // see a Redis failure to warn once per outage and say when it recovered.
    // Its single-flight buys little here — the key is one caller's, and
    // `requestMemo` already shares the answer within a request.
    const cached = await this.cacheGet(key);
    if (cached) return cached;

    const roles = await this.userRoleRepository.findRolesForUser(userId, organizationId);
    const value: RoleSet = {
      roleIds: roles.map((role) => role.id as string),
      permissions: roles.flatMap((role) =>
        role.permissions.map((permission) => permission.toDefinition()),
      ),
    };
    await this.cacheSet(key, value);
    return value;
  }

  /**
   * Also honour the Better Auth `user.role` column. The admin plugin's
   * `set-role` writes this column, so unioning it here (not just as a
   * fallback) keeps admin-plugin promotions in sync with CASL: a user
   * promoted to `admin`/`superadmin` gains that role's permissions even
   * though their `user_role` join still holds the default `user` row.
   */
  private async platformPermissions(
    role: string | undefined,
    catalogVersion: string,
  ): Promise<PermissionDefinition[]> {
    if (!role) return [];

    // Better Auth stores multiple platform roles as a comma-separated value.
    // Resolve each name independently so `user,admin` receives the same
    // control-plane permissions as a single `admin` role.
    const names = role
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    const permissions: PermissionDefinition[] = [];
    for (const name of names) {
      // Platform roles are global rows only — the registry holds nothing
      // else — so a tenant's role of the same name never stands in for them.
      const found = await this.globalRoles.permissionsOf(name, catalogVersion);
      permissions.push(...(found ?? SYSTEM_ROLE_PERMISSIONS[name] ?? []));
    }
    return permissions;
  }

  private async cacheGet(key: string): Promise<RoleSet | undefined> {
    try {
      const value = await this.cache.get<RoleSet>(key);
      this.cacheRecovered();
      return value;
    } catch (error) {
      this.cacheFailed(error);
      return undefined;
    }
  }

  private async cacheSet(key: string, value: RoleSet): Promise<void> {
    try {
      await this.cache.set(key, value, ROLE_SET_TTL_SECONDS);
      this.cacheRecovered();
    } catch (error) {
      this.cacheFailed(error);
    }
  }

  /** Once per outage, not once per request; never with the key or the value. */
  private cacheFailed(error: unknown): void {
    if (this.cacheFailing) return;
    this.cacheFailing = true;
    this.logger.warn(
      { message: 'authz cache unavailable; resolving permissions from the database' },
      error instanceof Error ? error.stack : String(error),
    );
  }

  private cacheRecovered(): void {
    if (!this.cacheFailing) return;
    this.cacheFailing = false;
    this.logger.log({ message: 'authz cache recovered' });
  }
}
