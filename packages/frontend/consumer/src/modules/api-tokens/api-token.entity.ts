import type { PermissionGroup, Scope } from '@oppenheimer/shared';

/**
 * An API token as the UI needs it. The secret is never part of this entity —
 * it exists only in the response to the call that created it.
 */
export class ApiTokenEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly prefix: string,
    public readonly scopes: Scope[],
    public readonly organizationIds: string[] | null,
    public readonly ipAllowlist: string[] | null,
    public readonly expiresAt: Date | null,
    public readonly lastUsedAt: Date | null,
    public readonly revokedAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  get isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  get isExpired(): boolean {
    return this.expiresAt !== null && this.expiresAt.getTime() <= Date.now();
  }

  /** Whether the token would authenticate a request right now. */
  get isActive(): boolean {
    return !this.isRevoked && !this.isExpired;
  }

  get status(): 'active' | 'expired' | 'revoked' {
    if (this.isRevoked) return 'revoked';
    if (this.isExpired) return 'expired';
    return 'active';
  }
}

/** A freshly minted token, with the one-time secret attached. */
export interface CreatedApiToken {
  token: ApiTokenEntity;
  /** Shown once. Never stored, never retrievable again. */
  secret: string;
}

/** The permission catalog plus what the signed-in user may grant. */
export interface PermissionCatalog {
  groups: PermissionGroup[];
  grantable: Scope[];
}

/** What the calling credential is, and what it can actually do. */
export interface CurrentCredential {
  kind: 'session' | 'api-token' | 'oauth';
  userId: string;
  email: string;
  grantedScopes: Scope[] | null;
  effectiveScopes: Scope[];
  organizationIds: string[] | null;
  expiresAt: Date | null;
}
