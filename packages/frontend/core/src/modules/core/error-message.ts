import { AppError, toAppError } from './errors';

/**
 * Keys {@link createErrorMessageResolver} looks up by name. Every locale in
 * `@oppenheimer/translations` must define these, otherwise the apps' typed `t()` will
 * reject the resolver.
 *
 * The per-code messages under `errors.byCode.*` are **not** here: the code is
 * only known at runtime, so they are resolved through
 * {@link ErrorMessageResolverOptions.translateCode} instead.
 */
export type ErrorMessageKey = 'errors.fallback' | 'errors.unreachable';

/**
 * Message lookup, narrower than i18next's `t` for the reason `TranslateFn`
 * (`validation/zod-error-map.ts`) gives.
 */
export type ErrorMessageTranslateFn = (key: ErrorMessageKey) => string;

export interface ErrorMessageResolverOptions {
  t: ErrorMessageTranslateFn;
  /**
   * Resolve an API problem `code` (e.g. `ORG_002`) to a message in the active
   * locale, or `undefined` when this locale has no entry for it.
   *
   * Kept separate from {@link t} because the key is built at runtime: a typed
   * `t` cannot accept `errors.byCode.${string}`, and widening it to `string`
   * would give up compile-time checking on every other key too.
   * `useErrorMessage` does the one unchecked lookup, guarded by an existence
   * check.
   */
  translateCode: (code: string) => string | undefined;
}

/** What a screen needs to render a failure. */
export interface ResolvedErrorMessage {
  /** Translated, user-facing sentence. Never a raw server string. */
  message: string;
  /** The API's catalog code, or whatever code the failure named (Better Auth's, say). */
  code?: string;
  /** Quote-in-a-bug-report id, when the server sent one. */
  correlationId?: string;
  /** Field-level failures, keyed by field name, for form handling. */
  fieldErrors: Record<string, string>;
}

/**
 * The problem document's `code` says *what* went wrong, but its `detail` and
 * `title` are English written for operators: rendering them would show a
 * Spanish user English for every failure the API produces. So the code picks
 * the message and the locale supplies it; a code this client has not learned
 * yet falls back to a translated sentence, never the server's wording.
 */
export function createErrorMessageResolver({ t, translateCode }: ErrorMessageResolverOptions) {
  /**
   * @param fallback Already-translated sentence to use when the failure carries
   *   no code this catalog knows. Pass the screen's own copy where it is more
   *   specific than the generic one ("Incorrect email or password"); omit it and
   *   a generic translated sentence is used.
   */
  return function resolveErrorMessage(error: unknown, fallback?: string): ResolvedErrorMessage {
    // An empty sentinel code: `toAppError` only overrides it when the error
    // actually carried one, so `code` stays falsy for a failure that named no
    // code at all rather than reporting a made-up one to the screen.
    const appError =
      error instanceof AppError ? error : toAppError(error, { code: '', message: '' });

    const { code, problem, status } = appError;
    const translated = code ? translateCode(code) : undefined;

    // "Unreachable" is claimed only when there is no HTTP status at all — the
    // request never got an answer. A failure that *has* a status was answered by
    // the server and deserves the caller's own copy, even when it carried no
    // problem document: Better Auth's client rejects a wrong password with a
    // plain 401 and no document, and telling that user to check their
    // connection would be actively misleading.
    const reachedServer = status !== undefined;
    const generic = reachedServer ? (fallback ?? t('errors.fallback')) : t('errors.unreachable');

    return {
      message: translated ?? generic,
      code: problem?.code ?? (code || undefined),
      correlationId: appError.correlationId,
      fieldErrors: appError.fieldErrors,
    };
  };
}
