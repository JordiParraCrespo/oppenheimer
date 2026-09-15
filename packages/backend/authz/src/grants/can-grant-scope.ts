import type { AccessScope } from '../scope/access-scope';

export interface AccessGrantInput {
  organizationId: string;
  resourceType: string;
  /** `null` means every row of that type — the strongest grant expressible. */
  resourceId: string | null;
}

/**
 * Whether `actorScope` is allowed to create this grant.
 *
 * A grant transfers reach exactly as a role rule does, so it needs the same
 * containment rule: you may only grant what you already hold. `resourceId:
 * null` ("every row of this type") is the strongest thing the table can
 * express, so only someone who already holds `'all'` may mint it.
 *
 * Without this, the grant endpoints are a self-service escalation path — which
 * is why they must not ship before this check does.
 */
export function canGrantScope(actorScope: AccessScope, grant: AccessGrantInput): boolean {
  if (actorScope.bypass) return true;

  // A grant is always written inside one tenant, and never a different one.
  if (!actorScope.organizationId) return false;
  if (grant.organizationId !== actorScope.organizationId) return false;

  const held = actorScope.grants.get(grant.resourceType);

  if (grant.resourceId === null) return held === 'all';
  if (held === 'all') return true;
  return held?.has(grant.resourceId) ?? false;
}
