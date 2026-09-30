/**
 * The one organization a request acts in — its **tenant**. Written once, when
 * the request is authenticated, and read by everything that asks which
 * organization: the ability, the `${activeOrganizationId}` placeholder, the
 * access scope and the handlers. The rule is `product/versions/mvp/08-auth.md`.
 */
export interface RequestTenant {
  /** `null` when the request acts in no organization: only global roles count. */
  readonly organizationId: string | null;
}

export interface TenantRequest {
  tenant?: RequestTenant;
}

/** A request nothing stamped acts in no organization. */
export function tenantOrganizationIdOf(request: TenantRequest): string | null {
  return request.tenant?.organizationId ?? null;
}
