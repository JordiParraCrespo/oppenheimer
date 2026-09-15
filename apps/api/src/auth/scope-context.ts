import type { ResourceScope, Scope } from '@oppenheimer/shared';
import type { Request } from 'express';

/**
 * What a scoped credential (an API token or an OAuth access token) authorizes.
 *
 * Its presence on a request is what makes that request *narrowed*: a browser
 * session carries no scope context and is governed by the user's roles alone,
 * while a scoped credential is additionally limited to these scopes and this
 * resource scope.
 */
/** The principal a credential acts on behalf of, as put on `request.user`. */
export interface CredentialOwner {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
}

export interface ScopeContext {
  kind: 'api-token' | 'oauth';
  /** Id of the token record (API token id, or a digest of the OAuth token). */
  credentialId: string;
  /** The user the credential acts on behalf of. */
  userId: string;
  /**
   * The owner's current record. Resolved with the credential so that a
   * deactivated or deleted owner takes every credential they issued down with
   * them, and so the roles the policies guard reads are always live.
   */
  owner: CredentialOwner;
  scopes: Scope[];
  resourceScope: ResourceScope;
  expiresAt: Date | null;
  /** Display prefix of an API token, for logs and error messages. */
  prefix?: string;
}

/**
 * Request augmented by the auth layer. `scopeContext` is absent for browser
 * sessions and present for scoped credentials.
 */
export interface ScopedRequest extends Request {
  user?: Record<string, unknown> | null;
  session?: Record<string, unknown> | null;
  ability?: unknown;
  scopeContext?: ScopeContext | null;
}

/** The organization selected in the caller's Better Auth session. */
export function activeOrganizationIdOf(request: ScopedRequest): string | null {
  const value = request.session?.activeOrganizationId;
  return typeof value === 'string' ? value : null;
}
