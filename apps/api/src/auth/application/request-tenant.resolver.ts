import { type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '@oppenheimer/backend-core';
import { z } from 'zod';
import {
  ORGANIZATION_PARAM_KEY,
  type OrganizationScope,
} from '../decorators/organization-scoped.decorator';
import { AuthErrors } from '../domain/auth.errors';
import type { RequestTenant } from '../domain/request-tenant.types';
import { pinnedOrganizationIdOf, type ScopeContext } from '../domain/scope-context.types';
import type { RequestTenantPort, TenantSourceRequest } from './request-tenant.port';

/** The same check `ParseUUIDPipe` makes, before anything reaches Postgres. */
const ORGANIZATION_ID = z.string().uuid();

/**
 * The `REQUEST_TENANT` adapter: the organization a route names through
 * `@OrganizationScoped`, otherwise the session's. The rule it implements is
 * `product/versions/mvp/08-auth.md`.
 */
@Injectable()
export class RequestTenantResolver implements RequestTenantPort {
  constructor(private readonly reflector: Reflector) {}

  stamp(
    context: ExecutionContext,
    request: TenantSourceRequest,
    credential?: ScopeContext | null,
  ): RequestTenant {
    if (request.tenant) return request.tenant;

    const tenant: RequestTenant = {
      organizationId:
        this.routeOrganizationId(context, request) ??
        this.sessionOrganizationId(request, credential),
    };
    Object.defineProperty(request, 'tenant', {
      value: Object.freeze(tenant),
      enumerable: true,
      writable: false,
      configurable: false,
    });
    return tenant;
  }

  /**
   * The organization the route names, checked; `undefined` when it names none
   * (or an optional query/body field is left out). Fails closed: a value that
   * is not a UUID is refused, never replaced by the session's organization.
   */
  private routeOrganizationId(
    context: ExecutionContext,
    request: TenantSourceRequest,
  ): string | undefined {
    const scope = this.reflector.getAllAndOverride<OrganizationScope | undefined>(
      ORGANIZATION_PARAM_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!scope) return undefined;

    const value = fieldsOf(request, scope.from)?.[scope.param];
    if (value === undefined || value === null || value === '') {
      if (scope.from !== 'path') return undefined;
      // The decorator names a path parameter the route does not declare.
      // Nothing a client sent can cause this, so it is the server's fault.
      throw new AppError(AuthErrors.ROUTE_ORGANIZATION_MISSING, {
        detail: `The route declares @OrganizationScoped('${scope.param}') but has no "${scope.param}" parameter.`,
      });
    }
    if (!ORGANIZATION_ID.safeParse(value).success) {
      throw new AppError(AuthErrors.ROUTE_ORGANIZATION_INVALID, {
        detail: `"${scope.param}" must be an organization id (a UUID).`,
        extensions: { param: scope.param },
      });
    }
    return value as string;
  }

  /**
   * The session's active organization. A guard that runs before
   * `ApiAuthGuard` has written the session passes the scoped credential
   * instead: its delegated session is pinned to the same organization.
   */
  private sessionOrganizationId(
    request: TenantSourceRequest,
    credential: ScopeContext | null | undefined,
  ): string | null {
    if (credential) return pinnedOrganizationIdOf(credential);
    const value = request.session?.activeOrganizationId;
    return typeof value === 'string' ? value : null;
  }
}

function fieldsOf(
  request: TenantSourceRequest,
  from: OrganizationScope['from'],
): Record<string, unknown> | undefined {
  if (from === 'path') return request.params;
  if (from === 'query') return request.query;
  const body = request.body;
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : undefined;
}
