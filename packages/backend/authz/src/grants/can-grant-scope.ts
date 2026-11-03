import { isPersonOwned, type ResourceDefinition } from '../registry/resource-definition';
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
 * Without it, the grant endpoints are a self-service escalation path.
 */
export function canGrantScope(
  actorScope: AccessScope,
  grant: AccessGrantInput,
  resource: Pick<ResourceDefinition, 'keys'> | undefined,
): boolean {
  // A person's own rows are passed on only by name, and only by someone already
  // granted that row (`isPersonOwned`). A type the registry does not know is
  // held to the same rule, so leaving the definition out never reopens it.
  const personOwned = resource === undefined || isPersonOwned(resource.keys);
  if (actorScope.bypass && !personOwned) return true;

  // A grant is always written inside one tenant, and never a different one.
  if (!actorScope.organizationId) return false;
  if (grant.organizationId !== actorScope.organizationId) return false;

  const held = actorScope.grants.get(grant.resourceType);

  if (grant.resourceId === null) return !personOwned && held === 'all';
  if (held === 'all') return !personOwned;
  return held?.has(grant.resourceId) ?? false;
}
