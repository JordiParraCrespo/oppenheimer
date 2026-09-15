import type { AccessScope } from './access-scope';

/** DI token for the application's {@link ScopeResolverPort} implementation. */
export const SCOPE_RESOLVER = Symbol('SCOPE_RESOLVER');

export interface ResolveScopeInput {
  userId: string;
  organizationId: string | null;
  /** Q0 — the platform tier short-circuits scoping entirely. */
  isPlatformAdmin: boolean;
  /** A `manage all` holder within the organization. */
  hasFullAccess: boolean;
}

/**
 * Resolves the caller's {@link AccessScope} for one request.
 *
 * Behind a port because the structural half is a product decision: the default
 * implementation reads flat team membership, but an application that needs
 * "a manager sees their reports' rows" or a region → territory → team tree can
 * substitute its own without touching a single call site. That is the whole
 * hierarchy seam.
 */
export interface ScopeResolverPort {
  resolve(input: ResolveScopeInput): Promise<AccessScope>;
}
