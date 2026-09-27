/**
 * Where the organization a request acts in came from.
 *
 * - `route` — the path parameter an `@OrganizationScoped` route names. The
 *   organization a route names is the organization authorization runs in.
 * - `header` — the `X-Active-Organization` override, checked against the
 *   caller's memberships, on a route that names no organization.
 * - `session` — the session's active organization (a token's delegated
 *   session carries one only when the token is pinned to one), or none.
 */
export type RequestTenantSource = 'route' | 'header' | 'session';

/**
 * The one organization a request acts in — its **tenant**.
 *
 * Resolved once, by `RequestTenantResolver`, when the request is authenticated,
 * and written to the request so that nothing downstream decides it again: the
 * ability `PoliciesGuard` checks, the `${activeOrganizationId}` condition
 * placeholder, the access scope `ScopeResolver` builds, and every controller
 * that passes "the organization" to a use case all read this value. Two
 * readers that each picked their own organization is how a route came to be
 * authorized in one tenant while its rows were scoped to another.
 */
export interface RequestTenant {
  /** `null` when the request acts in no organization: only global roles count. */
  readonly organizationId: string | null;
  readonly source: RequestTenantSource;
}

/** A request that may carry its tenant. */
export interface TenantRequest {
  tenant?: RequestTenant;
}

/**
 * The organization this request acts in.
 *
 * A request no auth guard stamped acts in no organization — `null`, so only the
 * caller's global roles apply. That is the closed answer: an unstamped request
 * never falls back to reading the session on its own.
 */
export function tenantOrganizationIdOf(request: TenantRequest): string | null {
  return request.tenant?.organizationId ?? null;
}
