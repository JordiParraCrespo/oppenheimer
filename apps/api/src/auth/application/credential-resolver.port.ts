import type { ScopeContext, ScopedRequest } from '../domain/scope-context.types';

/**
 * One kind of bearer credential, contributed by the module that owns it.
 *
 * The auth module is a kernel: it knows how a credential arrives (a bearer
 * header, `x-api-key`), what a resolved one authorizes ({@link ScopeContext}),
 * and the two kinds it issues itself — a Better Auth session and an OAuth
 * grant. It deliberately does **not** know the kinds built on top of it. An
 * API token is the api-tokens module's concept; a runner's key will be the
 * runner module's. Each registers a resolver with
 * `AuthModule.forFeature([...])`, and the kernel asks them in turn.
 *
 * Implementations live in the owning module's `application/` layer, where they
 * may inject that module's repository ports.
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
}
