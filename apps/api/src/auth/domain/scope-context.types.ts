import type { IncomingHttpHeaders } from 'node:http';
import type { ResourceScope, Scope } from '@oppenheimer/shared';
import type { RequestTenant } from './request-tenant.types';

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
 * How far a credential bounds a token minted with it: the token it mints may
 * not outlive `expiresAt` nor work from outside `ipAllowlist`. `null` is no
 * bound. Each resolver says what its own kind bounds, where it builds the
 * context, so the mint reads one field and asks no kind.
 */
export interface MintingBounds {
  expiresAt: Date | null;
  ipAllowlist: readonly string[] | null;
}

/**
 * What a scoped credential acting **for a person** authorizes: an API token, an
 * OAuth access token, or any other kind a module contributes that stands in for
 * someone.
 *
 * Its presence on a request is what makes that request *narrowed*: a browser
 * session carries no scope context and is governed by the user's roles alone,
 * while a scoped credential is additionally limited to these scopes and this
 * resource scope.
 */
export interface UserCredentialContext {
  /**
   * Which kind of credential this is. Open by design: the kernel resolves
   * `oauth` itself and every other kind is contributed by the module that owns
   * it (`api-token` today), so this is the contributing resolver's own `kind`.
   */
  kind: string;
  /** Id of the token record (API token id, or a digest of the OAuth token). */
  credentialId: string;
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
  /**
   * When the chain of credentials behind this one began: an OAuth grant's
   * issue, an API token's `issuedAt` (inherited from the credential that
   * minted it). The kernel refuses one older than the owner's last password
   * reset (`predatesCutoff`), and a credential minted with this one inherits
   * it, so a token minted in a request that raced the reset dies with it.
   */
  issuedAt: Date;
  /**
   * The addresses and CIDR blocks the credential is accepted from, when its
   * kind confines it (an API token's allowlist); absent or `null` for any.
   */
  ipAllowlist?: readonly string[] | null;
  /** Display prefix of an API token, for logs and error messages. */
  prefix?: string;
  /** What this credential bounds a token minted with it to. */
  mintingBounds: MintingBounds;
}

/**
 * What a credential acting **for a machine** authorizes: a host's boot
 * assertion, verified by the `hosts` module against the key that host
 * registered with, and contributed as the `host` kind.
 *
 * A variant of its own rather than a user credential with empty fields: a host
 * acts for nobody, so there is no `owner`, and the compiler says so. It carries
 * no scopes, so every route that declares one refuses it; only routes marked
 * `@AllowAnyScope()` are open to it.
 */
export interface HostCredentialContext {
  kind: 'host';
  /** Rate-limit and log identity: the host, since there is no token record. */
  credentialId: string;
  hostId: string;
  /** Always empty. A machine holds no permissions of its own. */
  scopes: Scope[];
  resourceScope: ResourceScope;
  expiresAt: Date | null;
  /** None: a host holds no `tokens:write`, so it never mints. */
  mintingBounds: MintingBounds;
}

/** Any credential that is not a browser session. */
export type ScopeContext = UserCredentialContext | HostCredentialContext;

/**
 * Narrow a resolved credential to the machine kind.
 *
 * A predicate rather than a bare `kind === 'host'` because the person-side
 * variant keeps its `kind` open — that openness is what lets a module contribute
 * a kind without editing this file — so only the variant that names itself can
 * be told apart by name.
 */
export function isHostCredential(
  context: ScopeContext | null | undefined,
): context is HostCredentialContext {
  return context?.kind === 'host';
}

/**
 * A request as the auth layer sees it: the headers a credential arrives in,
 * plus what the guards attach once they have resolved it.
 *
 * Structural rather than an `express.Request`, so neither this layer nor the
 * use-case controllers that name it depend on express. Express's `Request`
 * satisfies it, so `@Req() request: ScopedRequest` and
 * `getRequest<ScopedRequest>()` work unchanged.
 */
export interface ScopedRequest {
  headers: IncomingHttpHeaders;
  /** Route, body and query values `REQUEST_TENANT` reads an `@OrganizationScoped` id from. */
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
  /** The organization the request acts in, stamped once through `REQUEST_TENANT`. */
  tenant?: RequestTenant;
}

/**
 * The organization a scoped credential acts in when the route names none: the
 * one it is restricted to, if it is restricted to exactly one. A host
 * credential, or a credential restricted to several or none, has none.
 */
export function pinnedOrganizationIdOf(context: ScopeContext | null | undefined): string | null {
  if (!context || isHostCredential(context)) return null;
  const organizationIds = context.resourceScope.organizationIds;
  return organizationIds?.length === 1 ? organizationIds[0] : null;
}

/**
 * When the chain of credentials presenting this request began: a scoped
 * credential's `issuedAt`, else the browser session's creation (`null` when
 * neither is known). A credential minted by the request inherits it, so a
 * password reset that refuses the minter refuses what it minted too.
 */
export function credentialIssuedAtOf(request: ScopedRequest): Date | null {
  const context = request.scopeContext;
  if (context && !isHostCredential(context)) return context.issuedAt;
  const createdAt = request.session?.createdAt;
  return createdAt instanceof Date || typeof createdAt === 'string' ? new Date(createdAt) : null;
}
