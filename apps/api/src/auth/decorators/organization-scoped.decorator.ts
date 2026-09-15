import { SetMetadata } from '@nestjs/common';

export const ORGANIZATION_PARAM_KEY = 'organization_param';

/**
 * Names the route parameter carrying an organization id, so the global
 * `ScopesGuard` can enforce a credential's organization restriction.
 *
 * Without this a token restricted to one organization would still reach
 * another organization's members through a path parameter the guard cannot
 * recognise, so every organization-bound route declares it.
 *
 * @example
 * ```ts
 * @Get(':orgId/members')
 * @OrganizationScoped('orgId')
 * list() {}
 * ```
 */
export const OrganizationScoped = (param: string) => SetMetadata(ORGANIZATION_PARAM_KEY, param);
