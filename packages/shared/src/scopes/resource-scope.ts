/**
 * Resource scoping narrows a credential to specific organizations, on top of
 * the permissions it carries. `null` means "every organization the owner
 * belongs to" — the credential inherits the owner's reach and follows them as
 * they join or leave organizations, rather than pinning a list at mint time.
 */
export interface ResourceScope {
  organizationIds: string[] | null;
}

/** A credential with no organization restriction. */
export const UNRESTRICTED_RESOURCE_SCOPE: ResourceScope = {
  organizationIds: null,
};

/**
 * May this credential act on `organizationId`?
 *
 * A request that carries no organization at all is allowed: routes that are not
 * organization-bound (the user directory, role definitions) are governed by
 * scopes alone. Organization-bound routes always resolve an id, so a restricted
 * token can never reach an organization outside its list.
 */
export function isOrganizationAllowed(
  scope: ResourceScope | null | undefined,
  organizationId: string | null | undefined,
): boolean {
  const allowed = scope?.organizationIds;
  if (!allowed) return true;
  if (!organizationId) return true;
  return allowed.includes(organizationId);
}

/** Normalize a stored/user-supplied organization list into a {@link ResourceScope}. */
export function toResourceScope(
  organizationIds: readonly string[] | null | undefined,
): ResourceScope {
  if (!organizationIds || organizationIds.length === 0) return UNRESTRICTED_RESOURCE_SCOPE;
  return { organizationIds: [...new Set(organizationIds)].sort() };
}
