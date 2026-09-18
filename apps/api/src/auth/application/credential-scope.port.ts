import type { ScopeContext, ScopedRequest } from '../domain/scope-context.types';

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
}
