import type { ExecutionContext } from '@nestjs/common';
import type { RequestTenant, TenantRequest } from '../domain/request-tenant.types';
import type { ScopeContext } from '../domain/scope-context.types';

export interface TenantSourceRequest extends TenantRequest {
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: unknown;
  session?: Record<string, unknown> | null;
}

/**
 * Stamps a request with its tenant — the only writer of `request.tenant`.
 * Bound to {@link REQUEST_TENANT}; the auth guards stamp through it, and
 * everything else reads `tenantOrganizationIdOf(request)`.
 */
export interface RequestTenantPort {
  /**
   * Resolve the tenant and write it to `request.tenant`, once; a stamped
   * request keeps its tenant. `credential` is the scoped credential the
   * request presented, for a guard that runs before `request.session` exists.
   */
  stamp(
    context: ExecutionContext,
    request: TenantSourceRequest,
    credential?: ScopeContext | null,
  ): RequestTenant;
}
