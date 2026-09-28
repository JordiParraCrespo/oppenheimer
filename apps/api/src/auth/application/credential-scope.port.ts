import type { ScopeContext, ScopedRequest } from '../domain/scope-context.types';
import type { VerifiedSession } from '../infrastructure/credential-verifier.port';

/**
 * Answers "what credential is this request carrying, and what does it
 * authorize?" — once per request, for every guard that needs to know.
 *
 * A browser session resolves to `null`: it carries no scopes and is governed
 * by the person's roles alone. Anything else (an API token, an OAuth grant)
 * resolves to the {@link ScopeContext} that narrows it.
 */
export interface CredentialScopePort {
  /** Resolve (once per request) the scoped credential, or `null` for a session. */
  resolve(request: ScopedRequest): Promise<ScopeContext | null>;

  /**
   * The Better Auth session a request without a scoped credential carries — a
   * session token presented as a bearer, or a session cookie — or `null`.
   * Verified once per request: a bearer session is the one {@link resolve}
   * already verified, a cookie is looked up on first ask. Always `null` for a
   * scoped credential.
   */
  resolveSession(request: ScopedRequest): Promise<VerifiedSession | null>;

  /**
   * The rate-limit bucket this request's credential belongs to, derived
   * without verifying it — no database, no identity provider — or `null` when
   * it presents none worth a bucket of its own. A digest of the presented
   * secret, never the secret; a session cookie only when its signature checks.
   */
  rateLimitKey(request: ScopedRequest): Promise<string | null>;
}
