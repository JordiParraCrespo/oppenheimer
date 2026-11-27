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

/** Why a token may not be minted: the scopes beyond reach, and what was refused. */
export interface MintingRefusal {
  ungrantableScopes: Scope[];
  detail: string;
}

/**
 * Whether a new token reaches beyond what may grant it, as one refusal or
 * none. Its owner's roles bound every token (`ownerUngrantable`, the scopes
 * the roles do not back); a token minted with a token is also held to that
 * token's own reach, since `tokens:write` stands for its holder only as far
 * as its scopes and organizations go. A browser session (no credential) is
 * held to the roles alone. Each further bound on a minting credential is a
 * case here, not a branch in the handler.
 */
export function mintingRefusal(
  ownerUngrantable: readonly Scope[],
  credential: MintingCredentialReach | undefined,
  request: MintingReachRequest,
): MintingRefusal | null {
  const beyondCredential = credential ? missingScopes(credential.scopes, request.scopes) : [];
  const ungrantableScopes = [...new Set([...ownerUngrantable, ...beyondCredential])];
  if (ungrantableScopes.length > 0) {
    return {
      ungrantableScopes,
      detail: `The caller may not grant: ${ungrantableScopes.join(', ')}`,
    };
  }
  if (credential && leavesOrganizations(credential.organizationIds, request.organizationIds)) {
    return {
      ungrantableScopes: [],
      detail: 'A token minted with a token must be pinned within its organizations',
    };
  }
  return null;
}

/** No pin, or one outside the minting credential's; a credential with no pin reaches all. */
function leavesOrganizations(
  pinned: readonly string[] | null,
  requested: readonly string[] | null | undefined,
): boolean {
  if (pinned === null) return false;
  const within = new Set(pinned);
  const asked = requested ?? [];
  return asked.length === 0 || asked.some((id) => !within.has(id));
}
