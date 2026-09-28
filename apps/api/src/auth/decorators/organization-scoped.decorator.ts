import { SetMetadata } from '@nestjs/common';

export const ORGANIZATION_PARAM_KEY = 'organization_param';

/** Where a route carries the organization it acts on. */
export type OrganizationSource = 'path' | 'query' | 'body';

/** What `@OrganizationScoped` records on a route. */
export interface OrganizationScope {
  param: string;
  from: OrganizationSource;
}

/**
 * Names where a route carries the organization it acts on. That organization
 * is the request's tenant: its roles are the ones authorized, and the global
 * `ScopesGuard` holds a restricted credential to it.
 *
 * A path parameter is required. A `query` or `body` field is optional — a
 * request that leaves it out acts in the session's organization — and is for
 * the few routes that take an organization beside other input.
 *
 * @example
 * ```ts
 * @Get(':orgId/members')
 * @OrganizationScoped('orgId')
 * list() {}
 *
 * @Get()
 * @OrganizationScoped('organizationId', 'query')
 * listWorkspaces() {}
 * ```
 */
export const OrganizationScoped = (param: string, from: OrganizationSource = 'path') =>
  SetMetadata(ORGANIZATION_PARAM_KEY, { param, from } satisfies OrganizationScope);
