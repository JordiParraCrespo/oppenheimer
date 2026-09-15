import type { AbilityScopeContext, ScopeGrant } from '@oppenheimer/shared';

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
   * Skip scoping entirely — the platform tier, or a `manage all` holder.
   * Always audited when true, and never set for an impersonated session.
   */
  bypass: boolean;
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

/**
 * Project an {@link AccessScope} into the plain shape `@oppenheimer/shared` uses to
 * interpolate `${scope.*}` placeholders.
 *
 * The two types are deliberately separate: `@oppenheimer/shared` is consumed by the
 * browser and must not learn about server-side scope resolution, while the
 * kernel wants Sets and Maps for membership checks.
 */
export function toAbilityScopeContext(scope: AccessScope): AbilityScopeContext {
  const grants: Record<string, ScopeGrant> = {};
  for (const [subject, grant] of scope.grants) {
    grants[subject] = grant === 'all' ? 'all' : [...grant];
  }
  return {
    organizationId: scope.organizationId,
    teamIds: scope.teamIds,
    grants,
  };
}
