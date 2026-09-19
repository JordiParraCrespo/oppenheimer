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
 * What a credential acting **for a person** authorizes: an API token or an
 * OAuth access token.
 *
 * Its presence on a request is what makes that request *narrowed*: a browser
 * session carries no scope context and is governed by the user's roles alone,
 * while a scoped credential is additionally limited to these scopes and this
 * resource scope.
 */
export interface UserCredentialContext {
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
 * What a credential acting **for a machine** authorizes: a host's boot
 * assertion, verified against the key that host registered with.
 *
 * It is a kind of its own rather than a user credential with empty fields,
 * because a host has no owner to act as: nothing may read `owner` off it and
 * the compiler is what says so. It carries no scopes at all, which is the whole
 * of what the guards need to know — every route that declares a scope refuses
 * it by the ordinary rule, and the only routes open to it are the ones that
 * declare none and say so with `@AllowAnyScope()`.
 */
export interface HostCredentialContext {
  kind: 'host';
  /** Rate-limit and log identity: the host, since there is no token record. */
  credentialId: string;
  hostId: string;
  /** Always empty. A machine holds no permissions of its own. */
  scopes: Scope[];
  resourceScope: ResourceScope;
  /** When the presented assertion stops being valid. */
  expiresAt: Date | null;
}

/** Any credential that is not a browser session. */
export type ScopeContext = UserCredentialContext | HostCredentialContext;

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
