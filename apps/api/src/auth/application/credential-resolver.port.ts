import type { ScopeContext, ScopedRequest } from '../domain/scope-context.types';

/**
 * One kind of bearer credential, contributed by the module that owns it
 * through `AuthModule.contributeCredentials`. The kernel itself issues only
 * Better Auth sessions and OAuth grants; an API token is the api-tokens
 * module's kind, a host's boot assertion the hosts module's. Implementations
 * live in the owning module's `application/` layer, where they may inject its
 * repository ports.
 */
export interface CredentialResolverPort {
  /** The `ScopeContext['kind']` this resolver produces; unique across contributions. */
  readonly kind: string;

  /**
   * Cheap, side-effect-free shape check on the presented bearer string.
   *
   * Recognising is not verifying: it answers "is this mine to resolve?" from
   * the string alone (a prefix, a length), so the kernel can pick a resolver
   * without every contribution querying its store on every request.
   */
  recognises(presented: string): boolean;

  /**
   * Verify the recognised credential and describe what it authorizes.
   *
   * Refusal is a throw, not a `null`: a credential this resolver claimed and
   * then rejected must never fall through to another kind or to the session
   * path. Throw the module's own `AppError` so the caller gets the code that
   * kind of credential documents.
   */
  resolve(presented: string, request: ScopedRequest): Promise<ScopeContext>;

  /**
   * Set when every presented string is used once (a host's boot assertion
   * carries a `jti`). The rate limiter normally buckets a credential by a
   * digest of the string, unverified; for a single-use kind that would give
   * every request a bucket of its own. The kernel then resolves the credential
   * first — memoized, so the guard that authenticates the request reuses the
   * answer rather than burning the string twice — and buckets by its
   * `credentialId`.
   */
  readonly singleUse?: boolean;
}
