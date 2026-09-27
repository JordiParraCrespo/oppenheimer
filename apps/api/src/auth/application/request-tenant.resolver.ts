import { type ExecutionContext, Inject, Injectable, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '@oppenheimer/backend-core';
import { z } from 'zod';
import { ACTIVE_ORGANIZATION } from '../auth.di-tokens';
import { ORGANIZATION_PARAM_KEY } from '../decorators/organization-scoped.decorator';
import { AuthErrors } from '../domain/auth.errors';
import type { RequestTenant, TenantRequest } from '../domain/request-tenant.types';
import {
  ACTIVE_ORGANIZATION_HEADER,
  type ActiveOrganizationPort,
} from './active-organization.port';

/** The request members the tenant is read from and written to. */
interface ResolvableRequest extends TenantRequest {
  headers?: Record<string, string | string[] | undefined>;
  params?: Record<string, unknown>;
  user?: Record<string, unknown> | null;
  session?: Record<string, unknown> | null;
}

/** The same check `ParseUUIDPipe` makes, before anything reaches Postgres. */
const ORGANIZATION_ID = z.string().uuid();

/**
 * Decides, once per request, the organization it acts in — its tenant — and
 * writes it to `request.tenant` (see `RequestTenant`).
 *
 * 1. A route marked `@OrganizationScoped(param)` acts in the organization its
 *    path names. **It fails closed**: a value that is missing or not a UUID is
 *    refused here, never replaced by the session's organization — that would
 *    authorize the request in a tenant it does not name. It is also checked
 *    before any lookup, so a malformed id is a 400 rather than a Postgres
 *    error.
 * 2. Any other route acts in the session's active organization, or the
 *    organization an `X-Active-Organization` header names once
 *    {@link ACTIVE_ORGANIZATION} has checked the caller belongs to it. The
 *    header is not consulted on a route that names its organization: the path
 *    already said.
 *
 * `ApiAuthGuard` stamps the tenant right after it authenticates, so it is on
 * the request before any guard, interceptor or handler builds an ability. The
 * stamp is written once and cannot be reassigned.
 */
@Injectable()
export class RequestTenantResolver {
  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(ACTIVE_ORGANIZATION)
    private readonly activeOrganization?: ActiveOrganizationPort,
  ) {}

  /**
   * The organization an `@OrganizationScoped` route names in its path, checked;
   * `undefined` for a route that names none. `ScopesGuard` reads the same
   * answer to hold a credential to its organizations.
   */
  routeOrganizationId(context: ExecutionContext, request: ResolvableRequest): string | undefined {
    const param = this.reflector.getAllAndOverride<string | undefined>(ORGANIZATION_PARAM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!param) return undefined;

    const value = request.params?.[param];
    // The decorator names a parameter the route does not declare. Nothing a
    // client sent can cause this, so it is the server's fault, not theirs.
    if (value === undefined || value === null || value === '') {
      throw new AppError(AuthErrors.ROUTE_ORGANIZATION_MISSING, {
        detail: `The route declares @OrganizationScoped('${param}') but has no "${param}" parameter.`,
      });
    }
    if (!ORGANIZATION_ID.safeParse(value).success) {
      throw new AppError(AuthErrors.ROUTE_ORGANIZATION_INVALID, {
        detail: `"${param}" must be an organization id (a UUID).`,
        extensions: { param },
      });
    }
    return value as string;
  }

  /**
   * Resolve the request's tenant and write it to `request.tenant`, once.
   * A request already stamped keeps its tenant.
   */
  async stamp(context: ExecutionContext, request: ResolvableRequest): Promise<RequestTenant> {
    if (request.tenant) return request.tenant;

    const tenant = await this.resolve(context, request);
    Object.defineProperty(request, 'tenant', {
      value: Object.freeze(tenant),
      enumerable: true,
      writable: false,
      configurable: false,
    });
    return tenant;
  }

  private async resolve(
    context: ExecutionContext,
    request: ResolvableRequest,
  ): Promise<RequestTenant> {
    const fromRoute = this.routeOrganizationId(context, request);
    if (fromRoute !== undefined) return { organizationId: fromRoute, source: 'route' };

    const sessionValue = request.session?.activeOrganizationId;
    const sessionOrganizationId = typeof sessionValue === 'string' ? sessionValue : null;
    const header = headerValue(request.headers?.[ACTIVE_ORGANIZATION_HEADER])?.trim();
    const userId = typeof request.user?.id === 'string' ? request.user.id : undefined;

    // An anonymous caller has no memberships to check a header against, and a
    // deployment without the port has no way to check one: both act in the
    // session's organization (for an anonymous caller, none).
    if (!header || !userId || !this.activeOrganization) {
      return { organizationId: sessionOrganizationId, source: 'session' };
    }

    const organizationId = await this.activeOrganization.resolve({
      userId,
      sessionOrganizationId,
      header,
    });
    return {
      organizationId,
      source: organizationId === sessionOrganizationId ? 'session' : 'header',
    };
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
