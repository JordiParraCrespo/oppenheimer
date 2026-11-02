import { AppError } from '@oppenheimer/backend-core';
import type { AccessScope } from './access-scope';

/**
 * An {@link AccessScope} that acts inside one organization: the request's
 * tenant. Tenant rows are only ever written and read through one, so a port
 * that takes it cannot be handed the platform tier's global scope by mistake.
 */
export interface TenantScope extends AccessScope {
  organizationId: string;
}

/**
 * The one refusal for a tenant operation asked without an organization. It
 * used to be a code per module (`BOTS_002`, `TASKS_003`, …), each saying the
 * same thing about a different noun; a client acts on it the same way
 * whichever module answered: open a workspace and try again.
 */
export const TenancyErrors = {
  NO_ACTIVE_ORGANIZATION: {
    code: 'TENANT_001',
    message: 'No active workspace',
    httpStatus: 400,
  },
} as const;

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
