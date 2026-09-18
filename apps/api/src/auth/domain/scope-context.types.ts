import type { IncomingHttpHeaders } from 'node:http';
import type { ResourceScope, Scope } from '@oppenheimer/shared';

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

/**
 * What a scoped credential (an API token or an OAuth access token) authorizes.
 *
 * Its presence on a request is what makes that request *narrowed*: a browser
 * session carries no scope context and is governed by the user's roles alone,
 * while a scoped credential is additionally limited to these scopes and this
 * resource scope.
 */
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
 * A request as the auth layer sees it: the headers a credential arrives in,
 * plus what the guards attach once they have resolved it.
 *
 * Deliberately **structural rather than an `express.Request`**. Every
 * use-case controller in the app names this type, and making it extend the
 * framework's request would drag express into each of them — and into the
 * layer this file sits in. Express's `Request` satisfies this shape, so
 * `@Req() request: ScopedRequest` and `getRequest<ScopedRequest>()` both work
 * unchanged; nothing here depends on a member express alone provides.
 */
export interface ScopedRequest {
  headers: IncomingHttpHeaders;
  /** Route, body and query values the scope guards read to find an org id. */
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: unknown;
  /** Caller address, for the rate-limit bucket of an unauthenticated request. */
  ip?: string;
  socket?: { remoteAddress?: string };
  user?: Record<string, unknown> | null;
  session?: Record<string, unknown> | null;
  ability?: unknown;
  scopeContext?: ScopeContext | null;
}

/** The organization selected in the caller's session. */
export function activeOrganizationIdOf(request: Pick<ScopedRequest, 'session'>): string | null {
  const value = request.session?.activeOrganizationId;
  return typeof value === 'string' ? value : null;
}
