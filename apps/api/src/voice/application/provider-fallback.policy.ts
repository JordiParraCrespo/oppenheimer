import type { Logger } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { ErrorDefinition } from '@oppenheimer/backend-ddd';
import { chosenFirst } from '../domain/voice-preference.policy';

/** What the walk needs of a provider: its id and the cheap question it asks first. */
interface Walked {
  readonly id: string;
  availableFor(organizationId: string): Promise<boolean>;
}

/** One capability's walk: whose providers, which codes, what a log line says. */
export interface ProviderWalk<P extends Walked, R> {
  organizationId: string;
  /** Every provider, in the registry's order. */
  providers: readonly P[];
  /** The one the workspace chose, tried first; null is automatic. */
  chosen: string | null;
  /** The capability's code for "not now": answered at once, never retried elsewhere. */
  rateLimited: ErrorDefinition;
  /** The capability's code for "nobody to ask". */
  notConfigured: ErrorDefinition;
  logger: Logger;
  /** The log line when one fails: "A speech provider could not transcribe; trying the next". */
  failed: string;
  /** One provider's attempt, told whether it is the chosen one; it throws to fail. */
  attempt(provider: P, isChosen: boolean): Promise<R>;
}

/**
 * The fallback rule for every voice capability, written once
 * (`provider-integrations.md`): the chosen provider first, then the others in
 * the registry's order; a provider not available is skipped, asked here, in
 * order, so a lookup that fails is that provider failing; the first answer is
 * the answer; a rate limit is answered at once; when every available provider
 * failed, the first failure, since it is the one the workspace would have
 * used; when none is available, the capability's "not configured". What each
 * attempt sends (a model, a voice) is the caller's, in `attempt`.
 */
export async function firstProviderAnswer<P extends Walked, R>(
  walk: ProviderWalk<P, R>,
): Promise<R> {
  let first: unknown = null;
  let tried = false;
  for (const provider of chosenFirst(walk.providers, walk.chosen)) {
    try {
      if (!(await provider.availableFor(walk.organizationId))) continue;
      tried = true;
      return await walk.attempt(provider, provider.id === walk.chosen);
    } catch (error) {
      if (error instanceof AppError && error.code === walk.rateLimited.code) throw error;
      tried = true;
      first ??= error;
      // The detail says which answer it was ("answered 403 (as text/html)"):
      // the code alone says only that the provider refused, not why.
      const { code, detail } = error instanceof AppError ? error : {};
      walk.logger.warn({
        message: walk.failed,
        organizationId: walk.organizationId,
        provider: provider.id,
        code,
        detail,
      });
    }
  }
  if (tried) throw first;
  throw new AppError(walk.notConfigured);
}
