import { AppError } from '@oppenheimer/backend-core';
import type { AccessScope, TenantScope } from '../domain/access-scope.types';
import { TenancyErrors } from '../domain/tenancy.errors';

/**
 * Narrows the scope to a {@link TenantScope} for the rest of the use case, or
 * refuses with `TENANT_001` when it names no organization:
 *
 * ```ts
 * requireTenant(scope);
 * BotEntity.createNew({ organizationId: scope.organizationId, … });
 * ```
 */
export function requireTenant(scope: AccessScope): asserts scope is TenantScope {
  if (!scope.organizationId) throw new AppError(TenancyErrors.NO_ACTIVE_ORGANIZATION);
}

/**
 * The organization a command carries, or `TENANT_001` when it carries none:
 * {@link requireTenant} for a message that holds the id and not the scope.
 */
export function requireOrganization(
  organizationId: string | null | undefined,
): asserts organizationId is string {
  if (!organizationId) throw new AppError(TenancyErrors.NO_ACTIVE_ORGANIZATION);
}
