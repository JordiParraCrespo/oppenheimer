import type { AppAbility } from '@oppenheimer/shared';
import type { TenantRequest } from '../domain/request-tenant.types';

/**
 * The request members the ability builder reads and writes. The ability is
 * built in the request's tenant (`TenantRequest`) and no other organization.
 */
export interface AbilityRequest extends TenantRequest {
  user?: Record<string, unknown>;
  session?: {
    activeTeamId?: string | null;
  } | null;
  ability?: AppAbility;
}

/**
 * The caller's effective CASL ability for a request.
 *
 * `PoliciesGuard` is the kernel's inbound adapter for "may this person do it",
 * but *what* a person may do is the roles module's answer, built from the
 * roles assigned to them. The guard asks through this port so the kernel names
 * no feature module; `roles` binds its `AbilityFactory` to {@link ABILITY} and
 * remains the one place an ability is built and memoized.
 */
export interface AbilityPort {
  /**
   * The ability for this request in its tenant (`request.tenant`), built once
   * and memoized on the request. There is deliberately no organization
   * argument: the request says which organization it acts in, so every caller
   * gets the same answer.
   */
  forRequest(request: AbilityRequest): Promise<AppAbility>;
}
