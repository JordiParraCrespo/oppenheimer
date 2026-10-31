/**
 * Everything the caller may reach, before capabilities are considered.
 *
 * This answers Q1 (which tenant) and Q2 (which slice within it). What the
 * caller may *do* to those rows is a separate question, answered by their CASL
 * ability. Both must pass.
 */
export interface AccessScope {
  userId: string;
  /** Active organization. `null` only for platform-tier callers acting globally. */
  organizationId: string | null;
  /** Teams the caller belongs to within the active organization. */
  teamIds: readonly string[];
  /**
   * Explicit grants keyed by resource subject. `'all'` means every row of that
   * type within the organization; a set means exactly those ids.
   */
  grants: ReadonlyMap<string, ReadonlySet<string> | 'all'>;
  /**
   * Skip the slice within the tenant (team, own, grant): the platform tier, or a
   * `manage all` holder. The tenant still holds while `organizationId` is set.
   */
  bypass: boolean;
}

/**
 * An {@link AccessScope} that acts inside one organization: the request's
 * tenant. Tenant rows are only ever written and read through one, so a port
 * that takes it cannot be handed the platform tier's global scope by mistake.
 */
export interface TenantScope extends AccessScope {
  organizationId: string;
}

/** A scope that can reach nothing. The safe value to fall back to. */
export function emptyScope(userId: string, organizationId: string | null = null): AccessScope {
  return {
    userId,
    organizationId,
    teamIds: [],
    grants: new Map(),
    bypass: false,
  };
}
