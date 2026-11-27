import { missingScopes, type Scope } from '@oppenheimer/shared';

/**
 * The reach of the credential a token is minted with, when it is minted with
 * one rather than from a browser session: its scopes, and the organizations it
 * is pinned to (`null` for none).
 */
export interface MintingCredentialReach {
  scopes: readonly Scope[];
  organizationIds: readonly string[] | null;
}

export interface MintingReachRequest {
  scopes: readonly Scope[];
  organizationIds?: readonly string[] | null;
}

/**
 * What a new token asks for beyond the credential minting it. A token holding
 * `tokens:write` stands for its holder only as far as its own scopes and
 * organizations reach, so a narrow token cannot mint a wide one: the scopes it
 * lacks, and whether the new token would leave its organizations (no pin, or
 * one outside them). A browser session (no credential) is held to the
 * person's roles alone, elsewhere.
 */
export function exceedsMintingCredential(
  credential: MintingCredentialReach | undefined,
  request: MintingReachRequest,
): { scopes: readonly Scope[]; leavesOrganizations: boolean } {
  if (!credential) return { scopes: [], leavesOrganizations: false };
  const scopes = missingScopes(credential.scopes, request.scopes);
  if (credential.organizationIds === null) return { scopes, leavesOrganizations: false };
  const pinned = new Set(credential.organizationIds);
  const requested = request.organizationIds ?? [];
  const leavesOrganizations = requested.length === 0 || requested.some((id) => !pinned.has(id));
  return { scopes, leavesOrganizations };
}
