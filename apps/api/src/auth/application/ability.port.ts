import type { AppAbility } from '@oppenheimer/shared';

/** The request members the ability builder reads and writes. */
export interface AbilityRequest {
  user?: Record<string, unknown>;
  session?: {
    activeOrganizationId?: string | null;
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
  /** The ability for this request, built once and memoized on the request. */
  forRequest(request: AbilityRequest): Promise<AppAbility>;
}
