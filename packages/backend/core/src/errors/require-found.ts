import { AppError, type AppErrorOptions, type ErrorDefinition } from './app.error';

/**
 * What `requireFound` accepts: an `Option` from `oxide.ts`, typed by its shape
 * so this package does not depend on it.
 */
export interface Maybe<T> {
  isNone(): boolean;
  unwrap(): T;
}

/**
 * The value a lookup found, or the catalog error for its absence:
 *
 * ```ts
 * const automation = requireFound(found, AutomationErrors.NOT_FOUND);
 * ```
 *
 * It throws an `AppError` built from exactly what it is given, so the problem
 * document is the one a hand-written `if (found.isNone()) throw …` produced.
 */
export function requireFound<T>(
  found: Maybe<T>,
  error: ErrorDefinition,
  options?: AppErrorOptions,
): T {
  if (found.isNone()) throw new AppError(error, options);
  return found.unwrap();
}
