import { missingScopes, type Scope } from '@oppenheimer/shared';
import { allowlistWithin } from './ip-allowlist.policy';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The reach of the credential a token is minted with, when it is minted with
 * one rather than from a browser session: its scopes, the organizations it is
 * pinned to (`null` for none), when it stops working for good and the
 * addresses it is accepted from. An absent bound is none.
 */
export interface MintingCredentialReach {
  scopes: readonly Scope[];
  organizationIds: readonly string[] | null;
  /** The end of the credential's life; `null` for none (an OAuth access token is refreshed past its own). */
  expiresAt?: Date | null;
  /** The addresses and CIDR blocks it is accepted from; `null` or empty for any. */
  ipAllowlist?: readonly string[] | null;
}

export interface MintingReachRequest {
  scopes: readonly Scope[];
  organizationIds?: readonly string[] | null;
  /** The new token's lifetime; `null` or absent for one that never expires. */
  expiresInDays?: number | null;
  ipAllowlist?: readonly string[] | null;
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
 * as its scopes, organizations, lifetime and addresses go: a leaked
 * short-lived or address-bound token must not mint one that outlives it or
 * works from anywhere. A browser session (no credential) is held to the roles
 * alone. Each further bound on a minting credential is a case here, not a
 * branch in the handler.
 */
export function mintingRefusal(
  ownerUngrantable: readonly Scope[],
  credential: MintingCredentialReach | undefined,
  request: MintingReachRequest,
  now: Date,
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
  if (credential?.expiresAt && outlives(credential.expiresAt, request.expiresInDays, now)) {
    return {
      ungrantableScopes: [],
      detail: `A token minted with a token must expire by ${credential.expiresAt.toISOString()}, when that token does`,
    };
  }
  if (credential && !allowlistWithin(request.ipAllowlist, credential.ipAllowlist)) {
    return {
      ungrantableScopes: [],
      detail: 'A token minted with a token must be accepted only from addresses that token is',
    };
  }
  return null;
}

/** Whether a token of this lifetime (none: never expires) would outlive `end`. */
function outlives(end: Date, expiresInDays: number | null | undefined, now: Date): boolean {
  if (expiresInDays == null) return true;
  return now.getTime() + expiresInDays * MILLISECONDS_PER_DAY > end.getTime();
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
